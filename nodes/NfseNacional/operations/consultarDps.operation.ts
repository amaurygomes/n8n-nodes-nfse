import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { OperationContext } from './types';
import { DpsBuilder } from '../../../core/dps/dpsBuilder';
import { SefinClient } from '../../../core/client/sefinClient';
import { DanfseGenerator, type DanfseData, unescapeXml, maskDanfseData } from '../../../core/danfse/danfseGenerator';
import { DanfseHtmlGenerator } from '../../../core/danfse/danfseHtmlGenerator';
import { parseSefinResponseBody } from '../helpers/sefinResponse';

export async function consultarDps(this: IExecuteFunctions, i: number, ctx: OperationContext): Promise<INodeExecutionData[]> {
	const { certHolder, prestadorCnpj, codigoMunicipio, ambiente, customUrl, credRazaoSocial, credMunicipioNome, inscricaoMunicipal, formatDanfseUrl } = ctx;
	const returnData: INodeExecutionData[] = [];

	const idDps = this.getNodeParameter('idDpsConsulta', i) as string;
	const consultarDpsOpcoes = (this.getNodeParameter('consultarDpsOpcoes', i, {}) as Record<string, unknown>) || {};
	const timeoutMs = (consultarDpsOpcoes.timeoutMs as number) || 25000;
	const rejectUnauthorized = consultarDpsOpcoes.rejectUnauthorized !== true;
	const gerarPdf = consultarDpsOpcoes.gerarPdf === true;
	const gerarHtml = consultarDpsOpcoes.gerarHtml === true;
	const mascararDados = consultarDpsOpcoes.mascararDadosSigilosos === true;

	const client = new SefinClient({
		ambiente,
		customUrl,
		privateKeyPem: certHolder.privateKeyPem,
		certificatePem: certHolder.certificatePem,
		timeoutMs,
		rejectUnauthorized,
	});

	const response = await client.consultarNfsePorDps(idDps);
	let xmlAutorizado = '';

	if (response.body && response.body.nfseXmlGZipB64) {
		try {
			xmlAutorizado = DpsBuilder.decompressGzipB64ToXml(response.body.nfseXmlGZipB64 as string);
		} catch {
			// ignored
		}
	}

	const treated = parseSefinResponseBody(response.body, response.statusCode);
	const chaveAcesso = treated.chaveAcesso;
	const statusConsulta = response.statusCode === 200 ? 'AUTORIZADA' : treated.status;

	const consultDpsResult: INodeExecutionData = {
		pairedItem: { item: i },
		json: {
			sucesso: response.statusCode === 200,
			status: statusConsulta,
			mensagemRetorno: response.statusCode === 200
				? 'DPS consultada com sucesso na SEFIN Nacional.'
				: treated.mensagemRetorno,
			statusCode: response.statusCode,
			idDps,
			chaveAcesso,
			numeroNfse: treated.numeroNfse,
			dataProcessamento: treated.dataProcessamento,
			erros: treated.erros,
			alertas: treated.alertas,
			respostaSefin: response.body,
			xmlNfseAutorizado: xmlAutorizado || null,
			danfseUrl: formatDanfseUrl(chaveAcesso),
		},
	};

	if ((gerarPdf || gerarHtml) && xmlAutorizado) {
		const parts = credMunicipioNome.split('-').map((s: string) => s.trim());
		const munPrest = parts[0] || '';
		const ufPrest = parts[1] || '';
		const prestadorNome = credRazaoSocial;
		const cNumNfse = treated.numeroNfse || xmlAutorizado.match(/<nNFSe>([^<]+)<\/nNFSe>/i)?.[1] || '0';
		const cDescServ = unescapeXml(xmlAutorizado.match(/<xDescServ>([^<]+)<\/xDescServ>/i)?.[1] || 'Serviços prestados');
		const cValorServ = Number(xmlAutorizado.match(/<vServ>([^<]+)<\/vServ>/i)?.[1] || 0);

		const danfseData: DanfseData = {
			numeroNfse: cNumNfse,
			chaveAcesso,
			dpsNumero: idDps,
			dataEmissao: new Date().toLocaleDateString('pt-BR'),
			ambiente: ambiente === '1' ? 'Produção' : 'Homologação',
			status: statusConsulta,
			prestador: {
				razaoSocial: prestadorNome,
				cnpj: prestadorCnpj,
				inscricaoMunicipal: inscricaoMunicipal || undefined,
				municipio: munPrest,
				uf: ufPrest,
				codigoIbge: codigoMunicipio,
			},
			tomador: {
				nome: unescapeXml(xmlAutorizado.match(/<toma>[\s\S]*?<xNome>([^<]+)<\/xNome>/i)?.[1] || 'Tomador'),
				cpfCnpj: xmlAutorizado.match(/<toma>[\s\S]*?<(?:CNPJ|CPF)>([^<]+)<\/(?:CNPJ|CPF)>/i)?.[1],
				municipio: munPrest,
				uf: ufPrest,
			},
			servico: {
				descricao: cDescServ,
				codigoTributacao: xmlAutorizado.match(/<cTribNac>([^<]+)<\/cTribNac>/i)?.[1] || '',
				valorServicos: cValorServ,
			},
		};

		const danfseParaRenderizar = mascararDados ? maskDanfseData(danfseData) : danfseData;
		if (gerarPdf) {
			const pdfBuffer = await DanfseGenerator.generatePdf(danfseParaRenderizar);
			consultDpsResult.binary = {
				danfse: {
					data: pdfBuffer.toString('base64'),
					mimeType: 'application/pdf',
					fileName: `DANFSE-${cNumNfse}.pdf`,
					fileExtension: 'pdf',
				},
			};
		}
		if (gerarHtml) {
			const htmlContent = await DanfseHtmlGenerator.renderHtml(danfseParaRenderizar, '');
			if (!consultDpsResult.binary) consultDpsResult.binary = {};
			consultDpsResult.binary.danfse_html = {
				data: Buffer.from(htmlContent, 'utf-8').toString('base64'),
				mimeType: 'text/html',
				fileName: `DANFSE-${cNumNfse}.html`,
				fileExtension: 'html',
			};
		}
	}

	returnData.push(consultDpsResult);

	return returnData;
}
