import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { OperationContext } from './types';
import { DpsBuilder } from '../../../core/dps/dpsBuilder';
import { SefinClient } from '../../../core/client/sefinClient';
import { DanfseGenerator, type DanfseData, unescapeXml, maskDanfseData } from '../../../core/danfse/danfseGenerator';
import { DanfseHtmlGenerator } from '../../../core/danfse/danfseHtmlGenerator';
import { parseSefinResponseBody } from '../helpers/sefinResponse';

export async function consultar(this: IExecuteFunctions, i: number, ctx: OperationContext): Promise<INodeExecutionData[]> {
	const { certHolder, prestadorCnpj, codigoMunicipio, ambiente, customUrl, credRazaoSocial, credMunicipioNome, inscricaoMunicipal, credCnaePrincipal, credRegimeTributario, formatDanfseUrl } = ctx;
	const returnData: INodeExecutionData[] = [];

	const chaveAcesso = this.getNodeParameter('chaveAcessoConsulta', i) as string;
	const consultarOpcoes = (this.getNodeParameter('consultarOpcoes', i, {}) as Record<string, unknown>) || {};
	const consultarTimeoutMs = (consultarOpcoes.timeoutMs as number) || 25000;
	const consultarRejectUnauth = consultarOpcoes.rejectUnauthorized !== true;
	const consultarGerarPdf = consultarOpcoes.gerarPdf === true;
	const consultarGerarHtml = consultarOpcoes.gerarHtml === true;
	const consultarMascararDados = consultarOpcoes.mascararDadosSigilosos === true;

	const client = new SefinClient({
		ambiente,
		customUrl,
		privateKeyPem: certHolder.privateKeyPem,
		certificatePem: certHolder.certificatePem,
		timeoutMs: consultarTimeoutMs,
		rejectUnauthorized: consultarRejectUnauth,
	});

	const response = await client.consultarNfsePorChave(chaveAcesso);
	let xmlAutorizado = '';

	if (response.body && response.body.nfseXmlGZipB64) {
		try {
			xmlAutorizado = DpsBuilder.decompressGzipB64ToXml(response.body.nfseXmlGZipB64 as string);
		} catch {
			// ignored
		}
	}

	let isNotaCancelada = /<e101101/i.test(xmlAutorizado) ||
		/<pedRegEvento/i.test(xmlAutorizado) ||
		/<infPedCanc/i.test(xmlAutorizado) ||
		/<canc/i.test(xmlAutorizado) ||
		/Cancelamento de NFS-e/i.test(xmlAutorizado) ||
		/<tpEvento>101101<\/tpEvento>/i.test(xmlAutorizado);

	if (!isNotaCancelada && response.statusCode === 200) {
		try {
			const evtResp = await client.consultarEventos(chaveAcesso, '101101', 1);
			const bodyObj = typeof evtResp.body === 'object' && evtResp.body !== null ? (evtResp.body as Record<string, unknown>) : null;
			const hasErrors = bodyObj && Array.isArray(bodyObj.erros) && bodyObj.erros.length > 0;
			const temEventoCancelamento = bodyObj && Array.isArray(bodyObj.eventos) && (bodyObj.eventos as Array<Record<string, unknown>>).some((e) => String(e.tipoEvento) === '101101');
			if (evtResp.statusCode === 200 && (!hasErrors || temEventoCancelamento)) {
				isNotaCancelada = true;
			}
		} catch {
			// sem evento
		}
	}

	const treated = parseSefinResponseBody(response.body, response.statusCode);
	const statusConsulta = isNotaCancelada
		? 'CANCELADA'
		: (response.statusCode === 200 ? 'AUTORIZADA' : treated.status);

	const consultResult: INodeExecutionData = {
		pairedItem: { item: i },
		json: {
			sucesso: response.statusCode === 200,
			status: statusConsulta,
			mensagemRetorno: response.statusCode === 200
				? (isNotaCancelada ? 'NFS-e consultada com sucesso (Nota CANCELADA).' : 'NFS-e consultada com sucesso.')
				: treated.mensagemRetorno,
			statusCode: response.statusCode,
			chaveAcesso,
			erros: treated.erros,
			alertas: treated.alertas,
			respostaSefin: response.body,
			xmlNfseAutorizado: xmlAutorizado || null,
			danfseUrl: formatDanfseUrl(chaveAcesso),
		},
	};

	if ((consultarGerarPdf || consultarGerarHtml) && xmlAutorizado) {
		const parts = credMunicipioNome.split('-').map((s: string) => s.trim());
		let munPrest = parts[0] || '';
		let ufPrest = parts[1] || '';

		const matchLocEmi = xmlAutorizado.match(/<emit>[\s\S]*?<xLocEmi>([^<]+)<\/xLocEmi>/i);
		if (matchLocEmi) {
			const pLoc = matchLocEmi[1].trim().split('-');
			if (pLoc[0]) munPrest = unescapeXml(pLoc[0].trim());
			if (pLoc[1]) ufPrest = unescapeXml(pLoc[1].trim());
		}

		const matchEmitNome = xmlAutorizado.match(/<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>/i) ||
			xmlAutorizado.match(/<xNome>([^<]+)<\/xNome>/i);
		const emitNome = matchEmitNome ? unescapeXml(matchEmitNome[1].trim()) : (credRazaoSocial || certHolder.subject);

		const emitBlock = xmlAutorizado.match(/<emit>([\s\S]*?)<\/emit>/i)?.[1] || '';
		const matchEmitLgr = emitBlock ? emitBlock.match(/<xLgr>([^<]+)<\/xLgr>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<xLgr>([^<]+)<\/xLgr>/i);
		const matchEmitNro = emitBlock ? emitBlock.match(/<nro>([^<]+)<\/nro>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<nro>([^<]+)<\/nro>/i);
		const matchEmitBairro = emitBlock ? emitBlock.match(/<xBairro>([^<]+)<\/xBairro>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<xBairro>([^<]+)<\/xBairro>/i);
		const matchEmitCep = emitBlock ? emitBlock.match(/<CEP>([^<]+)<\/CEP>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<CEP>([^<]+)<\/CEP>/i);

		const matchCompet = xmlAutorizado.match(/<dCompet>([^<]+)<\/dCompet>/i);
		const comp = matchCompet ? matchCompet[1].trim() : undefined;

		const matchTribNac = xmlAutorizado.match(/<xTribNac>([^<]+)<\/xTribNac>/i);
		const matchLocPrest = xmlAutorizado.match(/<xLocPrestacao>([^<]+)<\/xLocPrestacao>/i);
		const cTribNacCode = xmlAutorizado.match(/<cTribNac>([^<]+)<\/cTribNac>/i)?.[1] || '';

		const tomaBlock = xmlAutorizado.match(/<toma>([\s\S]*?)<\/toma>/i)?.[1] || xmlAutorizado;
		const cNomeTomador = unescapeXml(tomaBlock.match(/<xNome>([^<]+)<\/xNome>/i)?.[1] || 'Consumidor Final');
		const cDocTomador = tomaBlock.match(/<(?:CNPJ|CPF)>([^<]+)<\/(?:CNPJ|CPF)>/i)?.[1] || '';
		const cFoneTomador = tomaBlock.match(/<fone>([^<]+)<\/fone>/i)?.[1];
		const cEmailTomador = unescapeXml(tomaBlock.match(/<email>([^<]+)<\/email>/i)?.[1] || '');

		const cLgrTomador = unescapeXml(tomaBlock.match(/<xLgr>([^<]+)<\/xLgr>/i)?.[1] || '');
		const cNroTomador = unescapeXml(tomaBlock.match(/<nro>([^<]+)<\/nro>/i)?.[1] || '');
		const cBairroTomador = unescapeXml(tomaBlock.match(/<xBairro>([^<]+)<\/xBairro>/i)?.[1] || '');
		const cCepTomador = tomaBlock.match(/<CEP>([^<]+)<\/CEP>/i)?.[1];
		const cMunCodTomador = tomaBlock.match(/<cMun>([^<]+)<\/cMun>/i)?.[1];
		let cMunTomador = unescapeXml(tomaBlock.match(/<xMun>([^<]+)<\/xMun>/i)?.[1] || '');
		let cUfTomador = unescapeXml(tomaBlock.match(/<UF>([^<]+)<\/UF>/i)?.[1] || '');

		if (!cMunTomador && cMunCodTomador && codigoMunicipio && cMunCodTomador === codigoMunicipio.replace(/\D/g, '')) {
			const cParts = credMunicipioNome.split('-').map((s: string) => s.trim());
			cMunTomador = cParts[0] || '';
			cUfTomador = cParts[1] || '';
		}

		const cDescServ = unescapeXml(xmlAutorizado.match(/<xDescServ>([^<]+)<\/xDescServ>/i)?.[1] || 'Serviços prestados');
		const cValorServ = Number(xmlAutorizado.match(/<vServ>([^<]+)<\/vServ>/i)?.[1] || 0);
		const cDescIncond = Number(xmlAutorizado.match(/<vDescIncond>([^<]+)<\/vDescIncond>/i)?.[1] || 0);
		const cValorDeducoes = Number(xmlAutorizado.match(/<(?:vDedRed|vDed)>([^<]+)<\/(?:vDedRed|vDed)>/i)?.[1] || 0);
		const cNumNfse = treated.numeroNfse || xmlAutorizado.match(/<nNFSe>([^<]+)<\/nNFSe>/i)?.[1] || '0';
		const cSerie = xmlAutorizado.match(/<(?:sDPS|serie)>([^<]+)<\/(?:sDPS|serie)>/i)?.[1];
		const cDpsNum = xmlAutorizado.match(/<nDPS>([^<]+)<\/nDPS>/i)?.[1];

		const destBlock = xmlAutorizado.match(/<dest>([\s\S]*?)<\/dest>/i)?.[1];
		const cNomeDest = destBlock ? unescapeXml(destBlock.match(/<xNome>([^<]+)<\/xNome>/i)?.[1]) : undefined;
		const cDocDest = destBlock ? destBlock.match(/<(?:CNPJ|CPF)>([^<]+)<\/(?:CNPJ|CPF)>/i)?.[1] : undefined;

		const intermBlock = xmlAutorizado.match(/<interm>([\s\S]*?)<\/interm>/i)?.[1];
		const cNomeInterm = intermBlock ? unescapeXml(intermBlock.match(/<xNome>([^<]+)<\/xNome>/i)?.[1]) : undefined;
		const cDocInterm = intermBlock ? intermBlock.match(/<(?:CNPJ|CPF)>([^<]+)<\/(?:CNPJ|CPF)>/i)?.[1] : undefined;

		const cPis = Number(xmlAutorizado.match(/<v(?:Ret)?PIS>([^<]+)<\/v(?:Ret)?PIS>/i)?.[1] || 0);
		const cCofins = Number(xmlAutorizado.match(/<v(?:Ret)?COFINS>([^<]+)<\/v(?:Ret)?COFINS>/i)?.[1] || 0);
		const cInss = Number(xmlAutorizado.match(/<v(?:Ret)?INSS>([^<]+)<\/v(?:Ret)?INSS>/i)?.[1] || 0);
		const cIrrf = Number(xmlAutorizado.match(/<v(?:Ret)?IRRF>([^<]+)<\/v(?:Ret)?IRRF>/i)?.[1] || 0);
		const cCsll = Number(xmlAutorizado.match(/<v(?:Ret)?CSLL>([^<]+)<\/v(?:Ret)?CSLL>/i)?.[1] || 0);
		const cTotalRetFed = cPis + cCofins + cInss + cIrrf + cCsll;

		const ibsBlock = xmlAutorizado.match(/<(?:IBSCBS|gIBSCBS)>([\s\S]*?)<\/(?:IBSCBS|gIBSCBS)>/i)?.[1];
		const cCstIbs = ibsBlock ? ibsBlock.match(/<[cC][sS][tT]>([^<]+)<\/[cC][sS][tT]>/i)?.[1] : undefined;
		const cClassTribIbs = ibsBlock ? ibsBlock.match(/<cClassTrib>([^<]+)<\/cClassTrib>/i)?.[1] : undefined;

		const matchInfComp = xmlAutorizado.match(/<(?:xInfComp|infAdic|xInf|infCompl)>([^<]+)<\/(?:xInfComp|infAdic|xInf|infCompl)>/i);
		const cInfComp = matchInfComp ? unescapeXml(matchInfComp[1].trim()) : undefined;

		const cAliqIss = Number(xmlAutorizado.match(/<pAliq>([^<]+)<\/pAliq>/i)?.[1] || 0);
		const cRetIss = xmlAutorizado.match(/<tpRetISSQN>([^<]+)<\/tpRetISSQN>/i)?.[1];
		const cValIss = Number(xmlAutorizado.match(/<vISSQN>([^<]+)<\/vISSQN>/i)?.[1] || 0);

		const cDataEmissao = new Date().toLocaleDateString('pt-BR');
		const consultDanfseData: DanfseData = {
			numeroNfse: cNumNfse,
			serie: cSerie,
			dpsNumero: cDpsNum,
			chaveAcesso,
			dataEmissao: cDataEmissao,
			competencia: comp,
			ambiente: ambiente === '1' ? 'Produção' : 'Homologação',
			status: statusConsulta,
			prestador: {
				razaoSocial: emitNome,
				cnpj: prestadorCnpj,
					codigoIbge: codigoMunicipio,
				inscricaoMunicipal: inscricaoMunicipal || undefined,
				municipio: munPrest,
				uf: ufPrest,
				logradouro: matchEmitLgr ? unescapeXml(matchEmitLgr[1].trim()) : undefined,
				numero: matchEmitNro ? unescapeXml(matchEmitNro[1].trim()) : undefined,
				bairro: matchEmitBairro ? unescapeXml(matchEmitBairro[1].trim()) : undefined,
				cep: matchEmitCep ? matchEmitCep[1].trim() : undefined,
				opSimpNac: Number(credRegimeTributario || 3),
			},
			tomador: {
				nome: cNomeTomador,
				cpfCnpj: cDocTomador,
				email: cEmailTomador || undefined,
				telefone: cFoneTomador || undefined,
				logradouro: cLgrTomador || undefined,
				numero: cNroTomador || undefined,
				bairro: cBairroTomador || undefined,
				cep: cCepTomador || undefined,
				municipio: cMunTomador || undefined,
				uf: cUfTomador || undefined,
			},
			destinatario: (cDocDest || cNomeDest) ? {
				cpfCnpj: cDocDest || undefined,
				nome: cNomeDest || undefined,
			} : undefined,
			intermediario: (cDocInterm || cNomeInterm) ? {
				cpfCnpj: cDocInterm || undefined,
				nome: cNomeInterm || undefined,
			} : undefined,
			servico: {
				descricao: cDescServ,
				codigoTributacao: cTribNacCode,
				discriminacaoTributacao: matchTribNac ? unescapeXml(matchTribNac[1].trim()) : undefined,
				cnae: credCnaePrincipal || undefined,
				municipioPrestacao: matchLocPrest ? unescapeXml(matchLocPrest[1].trim()) : `${munPrest} - ${ufPrest}`,
				valorServicos: cValorServ,
				valorLiquido: cValorServ - (cDescIncond > 0 ? cDescIncond : 0) - (cTotalRetFed > 0 ? cTotalRetFed : 0),
				valorDesconto: cDescIncond > 0 ? cDescIncond : undefined,
				valorDeducoes: cValorDeducoes > 0 ? cValorDeducoes : undefined,
				aliquotaIss: cAliqIss > 0 ? cAliqIss : undefined,
				retencaoIss: cRetIss || undefined,
				valorIss: cValIss > 0 ? cValIss : undefined,
			},
			tributosFederais: cTotalRetFed > 0 ? {
				pis: cPis,
				cofins: cCofins,
				inss: cInss,
				irrf: cIrrf,
				csll: cCsll,
				totalRetencoes: cTotalRetFed,
			} : undefined,
			ibscbs: (cCstIbs || cClassTribIbs) ? {
				cst: cCstIbs || '01',
				cClassTrib: cClassTribIbs || '000000',
			} : undefined,
			informacoesComplementares: cInfComp || undefined,
		};
		const danfseParaRenderizar = consultarMascararDados ? maskDanfseData(consultDanfseData) : consultDanfseData;
		if (consultarGerarPdf) {
			const pdfBuffer = await DanfseGenerator.generatePdf(danfseParaRenderizar);
			consultResult.binary = {
				danfse: {
					data: pdfBuffer.toString('base64'),
					mimeType: 'application/pdf',
					fileName: `DANFSE-${cNumNfse}.pdf`,
					fileExtension: 'pdf',
				},
			};
		}
		if (consultarGerarHtml) {
			const htmlContent = await DanfseHtmlGenerator.renderHtml(danfseParaRenderizar, '');
			if (!consultResult.binary) consultResult.binary = {};
			consultResult.binary.danfse_html = {
				data: Buffer.from(htmlContent, 'utf-8').toString('base64'),
				mimeType: 'text/html',
				fileName: `DANFSE-${cNumNfse}.html`,
				fileExtension: 'html',
			};
		}
	}

	returnData.push(consultResult);

	return returnData;
}
