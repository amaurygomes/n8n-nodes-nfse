import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationContext } from './types';
import { XmlSigner } from '../../../core/signature/xmlSigner';
import { DpsBuilder, type DpsInputData } from '../../../core/dps/dpsBuilder';
import { SefinClient } from '../../../core/client/sefinClient';
import { DanfseGenerator, type DanfseData, unescapeXml, maskDanfseData } from '../../../core/danfse/danfseGenerator';
import { DanfseHtmlGenerator } from '../../../core/danfse/danfseHtmlGenerator';
import { parseSefinResponseBody, extractTag } from '../helpers/sefinResponse';

export async function emitir(this: IExecuteFunctions, i: number, ctx: OperationContext, operation: string): Promise<INodeExecutionData[]> {
	const { credentials, certHolder, prestadorCnpj, codigoMunicipio, ambiente, customUrl, credRazaoSocial, credMunicipioNome, inscricaoMunicipal, credCnaePrincipal, credRegimeTributario, effectiveRegime, formatDanfseUrl } = ctx;
	const returnData: INodeExecutionData[] = [];

	const inputMode = this.getNodeParameter('inputMode', i) as string;
	const opcoes = (this.getNodeParameter('additionalFields', i, {}) as Record<string, unknown>) || {};
	const timeoutMs = (opcoes.timeoutMs as number) || 25000;
	const rejectUnauthorized = opcoes.rejectUnauthorized !== true;
	const emitirGerarPdf = opcoes.gerarPdf === true;
	const emitirGerarHtml = opcoes.gerarHtml === true;
	const emitirMascararDados = opcoes.mascararDadosSigilosos === true;
	const tpRetISSQN = Number(opcoes.tpRetISSQN || 1);
	const aliquotaIss = (opcoes.aliquotaIss !== undefined && opcoes.aliquotaIss !== '' && Number(opcoes.aliquotaIss) > 0) ? Number(opcoes.aliquotaIss) : undefined;
	const nifTomador = ((opcoes.nifTomador as string) || '').trim();
	const pixTxid = ((opcoes.pixTxid as string) || '').trim();

	const cTribMun = (opcoes.cTribMun as string) || '';
	const cnaeParam = (opcoes.cnae as string) || '';
	let optanteSimplesNacional = Number(credRegimeTributario || '3');
	const effectiveCnae = (cnaeParam || credCnaePrincipal || '').trim();
	let dataCompetencia = (opcoes.dataCompetencia as string) || '';
	const informacoesComplementares = (opcoes.informacoesComplementares as string) || '';
	let finalInfoCompl = informacoesComplementares;
	if (pixTxid) {
		finalInfoCompl = finalInfoCompl
			? `${finalInfoCompl} | Pagamento via Pix - TXID: ${pixTxid}`
			: `Pagamento via Pix - TXID: ${pixTxid}`;
	}
	let tomadorBairro = '';
	let tomadorCep = '';
	let tomadorLogradouro = '';
	let tomadorNumero = '';
	const tomadorTelefone = (opcoes.tomadorTelefone as string) || '';
	let tomadorCodigoMunicipio = '';
	let tomadorMunicipioNome = '';
	let valorDesconto = (opcoes.valorDesconto as number) || 0;
	const valorDeducoes = Number(opcoes.valorDeducoes || 0);
	const intermediarioCpfCnpj = (opcoes.intermediarioCpfCnpj as string || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
	const intermediarioNome = (opcoes.intermediarioNome as string || '').trim();
	const retencaoPis = Number(opcoes.retencaoPis || 0);
	const retencaoCofins = Number(opcoes.retencaoCofins || 0);
	const retencaoInss = Number(opcoes.retencaoInss || 0);
	const retencaoIrrf = Number(opcoes.retencaoIrrf || 0);
	const retencaoCsll = Number(opcoes.retencaoCsll || 0);
	const cstIbsCbs = (opcoes.cstIbsCbs as string || '').trim();
	const cClassTrib = (opcoes.cClassTrib as string || '').trim();
	const descontoCondicionado = Number(opcoes.descontoCondicionado || 0);
	const codigoNbs = ((opcoes.codigoNbs as string) || '').trim();
	const regEspTrib = Number(opcoes.regEspTrib ?? 0);
	const tomadorComplemento = ((opcoes.tomadorComplemento as string) || '').trim();
	const tomadorInscricaoMunicipal = ((opcoes.tomadorInscricaoMunicipal as string) || '').trim();
	const intermediarioIm = ((opcoes.intermediarioIm as string) || '').trim();

	let unsignedXml = '';
	let nDps = '';
	let vServico = 0;
	let tomadorNome = '';
	let tomadorDoc = '';
	let tomadorEmail = '';
	let descServico = '';
	let cTribNac = '';
	let serieDps = '1';
	let cLocPrestacao = '';

	if (inputMode === 'rawXml') {
		unsignedXml = this.getNodeParameter('rawXmlContent', i) as string;
		// Extrai dados para o DANFSe dinamicamente a partir do XML informado
		tomadorNome = extractTag(unsignedXml, 'xNome');
		tomadorDoc = extractTag(unsignedXml, 'CNPJ') || extractTag(unsignedXml, 'CPF');
		tomadorEmail = extractTag(unsignedXml, 'email');
		descServico = extractTag(unsignedXml, 'xDescServ');
		cTribNac = extractTag(unsignedXml, 'cTribNac') || '';
		vServico = Number(extractTag(unsignedXml, 'vServ') || 0);
		nDps = extractTag(unsignedXml, 'nDPS') || String(Date.now()).slice(-9);
		serieDps = extractTag(unsignedXml, 'serie') || '1';
		cLocPrestacao = extractTag(unsignedXml, 'cLocPrestacao') || '';
		optanteSimplesNacional = Number(extractTag(unsignedXml, 'opSimpNac') || optanteSimplesNacional);
	} else {
		tomadorNome = this.getNodeParameter('tomadorNome', i) as string;
		tomadorDoc = this.getNodeParameter('tomadorCpfCnpj', i) as string;
		tomadorEmail = (opcoes.tomadorEmail as string) || '';
		vServico = this.getNodeParameter('valorServico', i) as number;
		descServico = this.getNodeParameter('descricaoServico', i) as string;
		cTribNac = this.getNodeParameter('cTribNac', i) as string;
		cLocPrestacao = this.getNodeParameter('cLocPrestacao', i, '') as string;
		const paramSimples = Number(this.getNodeParameter('optanteSimplesNacional', i, 0));
		if (paramSimples > 0) {
			optanteSimplesNacional = paramSimples;
		}

		const userNumDps = (this.getNodeParameter('numeroDps', i, '') as string) || '';
		serieDps = (this.getNodeParameter('serieDps', i) as string) || '1';

		nDps = userNumDps && userNumDps.trim() ? userNumDps.trim() : String(Date.now()).slice(-9);

		tomadorLogradouro = (opcoes.tomadorLogradouro as string) || '';
		tomadorNumero = (opcoes.tomadorNumero as string) || '';
		tomadorBairro = (opcoes.tomadorBairro as string) || '';
		tomadorCep = (opcoes.tomadorCep as string) || '';
		tomadorMunicipioNome = ((opcoes.tomadorMunicipioNome as string) || '').trim();
		tomadorCodigoMunicipio = ((opcoes.tomadorCodigoMunicipio as string) || '').replace(/\D/g, '');
		const tomadorComplemento = (opcoes.tomadorComplemento as string) || '';
		const tomadorPais = ((opcoes.tomadorPais as string) || '').trim();
		const tomadorCidadeExterior = ((opcoes.tomadorCidadeExterior as string) || '').trim();
		const tomadorEstadoExterior = ((opcoes.tomadorEstadoExterior as string) || '').trim();
		const tomadorCepExterior = ((opcoes.tomadorCepExterior as string) || '').trim();

		if (!codigoMunicipio) {
			throw new NodeOperationError(
				this.getNode(),
				'O Código IBGE do Município Emissor (7 dígitos) não foi configurado nas Credenciais.',
				{ itemIndex: i },
			);
		}
		if (!prestadorCnpj) {
			throw new NodeOperationError(
				this.getNode(),
				'O CNPJ do Prestador não foi identificado no Certificado A1 nem configurado nas Credenciais.',
				{ itemIndex: i },
			);
		}

		const tomadorMunCod = tomadorCodigoMunicipio || codigoMunicipio;

		const dpsInput: DpsInputData = {
			ambiente: Number(ambiente),
			cLocEmi: codigoMunicipio,
			serieDps,
			nDPS: nDps,
			dCompet: dataCompetencia || undefined,
			prestador: {
				cnpj: prestadorCnpj,
				opSimpNac: optanteSimplesNacional,
				regEspTrib: regEspTrib || undefined,
			},
			tomador: {
				cpfCnpj: nifTomador ? undefined : tomadorDoc,
				cNIF: nifTomador || undefined,
				im: tomadorInscricaoMunicipal || undefined,
				xNome: tomadorNome,
				email: tomadorEmail,
				telefone: tomadorTelefone || undefined,
				endereco: (tomadorLogradouro || tomadorCep || tomadorBairro || tomadorNumero || tomadorComplemento || tomadorPais || tomadorCidadeExterior) ? {
					xLgr: tomadorLogradouro || undefined,
					nro: tomadorNumero || 'S/N',
					xCpl: tomadorComplemento || undefined,
					xBairro: tomadorBairro || undefined,
					cep: tomadorCep ? tomadorCep.replace(/\D/g, '') : undefined,
					cMun: tomadorMunCod,
					cPais: tomadorPais || undefined,
					cEndPost: tomadorCepExterior || undefined,
					xCid: tomadorCidadeExterior || undefined,
					xEstProv: tomadorEstadoExterior || undefined,
				} : undefined,
			},
			intermediario: (intermediarioCpfCnpj || intermediarioNome) ? {
				cpfCnpj: intermediarioCpfCnpj || undefined,
				xNome: intermediarioNome || undefined,
				im: intermediarioIm || undefined,
			} : undefined,
			servico: {
				cTribNac,
				cTribMun: cTribMun || undefined,
				cNBS: codigoNbs || undefined,
				cnae: effectiveCnae || undefined,
				cLocPrestacao: cLocPrestacao || undefined,
				xDescServ: descServico,
			},
			valores: {
				vServ: vServico,
				vDescIncond: valorDesconto > 0 ? valorDesconto : undefined,
				vDescCond: descontoCondicionado > 0 ? descontoCondicionado : undefined,
				vDedRed: valorDeducoes > 0 ? valorDeducoes : undefined,
				pAliq: (aliquotaIss !== undefined && aliquotaIss > 0) ? aliquotaIss : undefined,
				tpRetISSQN,
				tribFed: (retencaoPis > 0 || retencaoCofins > 0 || retencaoInss > 0 || retencaoIrrf > 0 || retencaoCsll > 0) ? {
					vPIS: retencaoPis > 0 ? retencaoPis : undefined,
					vCOFINS: retencaoCofins > 0 ? retencaoCofins : undefined,
					vRetCSLL: retencaoCsll > 0 ? retencaoCsll : undefined,
					vRetIRRF: retencaoIrrf > 0 ? retencaoIrrf : undefined,
					vRetINSS: retencaoInss > 0 ? retencaoInss : undefined,
				} : undefined,
			},
			ibscbs: (cstIbsCbs || cClassTrib) ? {
				cst: cstIbsCbs || '01',
				cClassTrib: cClassTrib || '000000',
			} : undefined,
			informacoesComplementares: finalInfoCompl || undefined,
		};

		if (operation === 'substituir') {
			dpsInput.substituicao = {
				chSubstda: this.getNodeParameter('chSubstda', i) as string,
				cMotivo: this.getNodeParameter('cMotivoSubst', i) as string,
				xMotivo: this.getNodeParameter('xMotivoSubst', i, '') as string || undefined,
			};
		}

		const buildResult = DpsBuilder.buildXml(dpsInput);
		unsignedXml = buildResult.xml;
	}

	// 2. Assina o XML da DPS
	let signedXml = XmlSigner.signDps(unsignedXml, certHolder.privateKeyPem, certHolder.certificatePem);

	// 3. Compacta em GZIP Base64
	let gzipB64 = DpsBuilder.compressXmlToGzipB64(signedXml);

	// 4. Transmite para a SEFIN Nacional
	const client = new SefinClient({
		ambiente,
		customUrl,
		privateKeyPem: certHolder.privateKeyPem,
		certificatePem: certHolder.certificatePem,
		timeoutMs,
		rejectUnauthorized,
	});

	let response = await client.emitirDps(gzipB64);

	// 5. Trata a resposta da SEFIN no estilo JSON limpo e estruturado
	let treated = parseSefinResponseBody(response.body, response.statusCode);

	// Fallback automático caso o servidor de Produção ainda esteja no schema pré-NT009 (sem <finNFSe> em <infDPS>)
	if (
		!treated.sucesso &&
		treated.erros.some((e) => e.codigo === 'E1235' && e.mensagem.includes("invalid child element 'finNFSe'"))
	) {
		const fallbackXml = unsignedXml.replace(/\s*<finNFSe>[^<]*<\/finNFSe>/, '');
		signedXml = XmlSigner.signDps(fallbackXml, certHolder.privateKeyPem, certHolder.certificatePem);
		gzipB64 = DpsBuilder.compressXmlToGzipB64(signedXml);
		response = await client.emitirDps(gzipB64);
		treated = parseSefinResponseBody(response.body, response.statusCode);
	}

	let xmlAutorizado = '';
	const respBodyRecord = response.body && typeof response.body === 'object'
		? (response.body as Record<string, unknown>)
		: null;
	if (respBodyRecord && typeof respBodyRecord.nfseXmlGZipB64 === 'string') {
		try {
			xmlAutorizado = DpsBuilder.decompressGzipB64ToXml(respBodyRecord.nfseXmlGZipB64);
			const matchNum = xmlAutorizado.match(/<nNFSe>([^<]+)<\/nNFSe>/i);
			if (matchNum) treated.numeroNfse = matchNum[1].trim();
		} catch {
			// ignored
		}
	}

	const chaveAcesso = treated.chaveAcesso;
	const numeroNfse = treated.numeroNfse || nDps;

	let prestadorRazao = credRazaoSocial;
	let munPrestador = '';
	let ufPrestador = '';

	if (credMunicipioNome) {
		const parts = credMunicipioNome.split('-').map((s) => s.trim());
		munPrestador = parts[0] || '';
		ufPrestador = parts[1] || '';
	}

	// Atualiza dados dinâmicos a partir do XML autorizado pelo governo, se disponível
	if (xmlAutorizado) {
		const matchEmitNome = xmlAutorizado.match(/<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>/i) ||
			xmlAutorizado.match(/<xNome>([^<]+)<\/xNome>/i);
		if (matchEmitNome && !prestadorRazao) prestadorRazao = unescapeXml(matchEmitNome[1].trim());

		const matchLocEmi = xmlAutorizado.match(/<emit>[\s\S]*?<xLocEmi>([^<]+)<\/xLocEmi>/i);
		if (matchLocEmi) {
			const pLoc = matchLocEmi[1].trim().split('-');
			if (pLoc[0]) munPrestador = unescapeXml(pLoc[0].trim());
			if (pLoc[1]) ufPrestador = unescapeXml(pLoc[1].trim());
		}

		const matchMun = xmlAutorizado.match(/<(?:enderNac|enderEmit)>[\s\S]*?<xMun>([^<]+)<\/xMun>/i);
		if (matchMun) munPrestador = unescapeXml(matchMun[1].trim());
		const matchUf = xmlAutorizado.match(/<(?:enderNac|enderEmit)>[\s\S]*?<UF>([^<]+)<\/UF>/i);
		if (matchUf) ufPrestador = unescapeXml(matchUf[1].trim());

		const matchCompet = xmlAutorizado.match(/<dCompet>([^<]+)<\/dCompet>/i);
		if (matchCompet && !dataCompetencia) dataCompetencia = matchCompet[1].trim();

		const authTomaNome = xmlAutorizado.match(/<toma>[\s\S]*?<xNome>([^<]+)<\/xNome>/i);
		if (authTomaNome && !tomadorNome) tomadorNome = unescapeXml(authTomaNome[1].trim());

		const authTomaDoc = xmlAutorizado.match(/<toma>[\s\S]*?<(?:CNPJ|CPF)>([^<]+)<\/(?:CNPJ|CPF)>/i);
		if (authTomaDoc && !tomadorDoc) tomadorDoc = authTomaDoc[1].trim();

		const authDesc = xmlAutorizado.match(/<xDescServ>([^<]+)<\/xDescServ>/i);
		if (authDesc && !descServico) descServico = unescapeXml(authDesc[1].trim());

		const authValor = xmlAutorizado.match(/<vServ>([^<]+)<\/vServ>/i);
		if (authValor && !vServico) vServico = Number(authValor[1].trim());

		const authDescIncond = xmlAutorizado.match(/<vDescIncond>([^<]+)<\/vDescIncond>/i);
		if (authDescIncond && !valorDesconto) valorDesconto = Number(authDescIncond[1].trim());
	}

	if (!prestadorRazao) {
		prestadorRazao = certHolder.subject || 'Razão Social Não Informada';
	}

	const agora = new Date();
	const dataFormatada = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

	const executionResult: INodeExecutionData = {
		pairedItem: { item: i },
		json: {
			sucesso: treated.sucesso,
			status: treated.status,
			mensagemRetorno: treated.mensagemRetorno,
			chaveAcesso: chaveAcesso || null,
			numeroNfse,
			ambiente: ambiente === '1' ? 'PRODUCAO' : 'HOMOLOGACAO',
			danfseUrl: formatDanfseUrl(chaveAcesso),
			erros: treated.erros,
			alertas: treated.alertas,
			dataProcessamento: treated.dataProcessamento || dataFormatada,
			dadosEmissao: {
				prestadorCnpj,
				prestadorRazaoSocial: prestadorRazao,
				prestadorMunicipio: munPrestador ? `${munPrestador}${ufPrestador ? ' - ' + ufPrestador : ''}` : undefined,
				tomadorCpfCnpj: tomadorDoc,
				tomadorNome: unescapeXml(tomadorNome) || 'Consumidor Final',
				tomadorEndereco: (tomadorLogradouro || tomadorCep || tomadorBairro || tomadorNumero) ? {
					logradouro: tomadorLogradouro || undefined,
					numero: tomadorNumero || 'S/N',
					bairro: tomadorBairro || undefined,
					cep: tomadorCep || undefined,
					municipio: tomadorMunicipioNome || undefined,
					codigoMunicipio: tomadorCodigoMunicipio || codigoMunicipio,
				} : null,
				valorServicos: vServico,
				valorLiquido: vServico - (valorDesconto > 0 ? valorDesconto : 0),
				numeroDps: nDps,
				serieDps,
			},
			respostaSefin: response.body,
			xmlNfseAutorizado: xmlAutorizado || null,
			xmlDpsAssinado: signedXml,
			certificadoTitular: certHolder.subject,
			certificadoValidade: certHolder.validTo.toISOString(),
			pixTxid: pixTxid || null,
			statusCode: response.statusCode,
		},
	};

	if ((emitirGerarPdf || emitirGerarHtml) && chaveAcesso && treated.sucesso) {
		let emitLgr = tomadorLogradouro;
		let emitNro = tomadorNumero;
		let emitBairro = tomadorBairro;
		let emitCep = tomadorCep;

		if (xmlAutorizado) {
			const emitBlock = xmlAutorizado.match(/<emit>([\s\S]*?)<\/emit>/i)?.[1] || '';
			const matchEmitLgr = emitBlock ? emitBlock.match(/<xLgr>([^<]+)<\/xLgr>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<xLgr>([^<]+)<\/xLgr>/i);
			const matchEmitNro = emitBlock ? emitBlock.match(/<nro>([^<]+)<\/nro>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<nro>([^<]+)<\/nro>/i);
			const matchEmitBairro = emitBlock ? emitBlock.match(/<xBairro>([^<]+)<\/xBairro>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<xBairro>([^<]+)<\/xBairro>/i);
			const matchEmitCep = emitBlock ? emitBlock.match(/<CEP>([^<]+)<\/CEP>/i) : xmlAutorizado.match(/<emit>[\s\S]*?<CEP>([^<]+)<\/CEP>/i);

			if (matchEmitLgr) emitLgr = unescapeXml(matchEmitLgr[1].trim());
			if (matchEmitNro) emitNro = unescapeXml(matchEmitNro[1].trim());
			if (matchEmitBairro) emitBairro = unescapeXml(matchEmitBairro[1].trim());
			if (matchEmitCep) emitCep = matchEmitCep[1].trim();
		}

		const totalRetFedNum = retencaoPis + retencaoCofins + retencaoInss + retencaoIrrf + retencaoCsll;
		const emitDanfseData: DanfseData = {
			numeroNfse: String(numeroNfse),
			serie: serieDps,
			chaveAcesso,
			dataEmissao: new Date().toLocaleDateString('pt-BR'),
			competencia: dataCompetencia || undefined,
			ambiente: ambiente === '1' ? 'Produção' : 'Homologação',
			status: 'AUTORIZADA',
			prestador: {
				razaoSocial: prestadorRazao,
				cnpj: prestadorCnpj,
				codigoIbge: codigoMunicipio,
				inscricaoMunicipal: inscricaoMunicipal || undefined,
				municipio: munPrestador,
				uf: ufPrestador,
				logradouro: emitLgr || (credentials.prestadorEndereco as string) || undefined,
				numero: emitNro || undefined,
				bairro: emitBairro || undefined,
				cep: emitCep || (credentials.prestadorCep as string) || undefined,
				email: (credentials.prestadorEmail as string) || undefined,
				telefone: (credentials.prestadorTelefone as string) || undefined,
				opSimpNac: effectiveRegime,
			},
			tomador: {
				nome: unescapeXml(tomadorNome) || 'Consumidor Final',
				cpfCnpj: nifTomador ? `NIF: ${nifTomador}` : tomadorDoc,
				email: tomadorEmail || undefined,
				telefone: tomadorTelefone || undefined,
				logradouro: tomadorLogradouro || undefined,
				numero: tomadorNumero || undefined,
				complemento: unescapeXml(tomadorComplemento) || undefined,
				bairro: tomadorBairro || undefined,
				cep: tomadorCep || undefined,
				municipio: tomadorMunicipioNome || undefined,
				inscricaoMunicipal: unescapeXml(tomadorInscricaoMunicipal) || undefined,
			},
			intermediario: (intermediarioCpfCnpj || intermediarioNome) ? {
				cpfCnpj: intermediarioCpfCnpj || undefined,
				nome: intermediarioNome || undefined,
				inscricaoMunicipal: unescapeXml(intermediarioIm) || undefined,
			} : undefined,
			servico: {
				descricao: unescapeXml(descServico) || 'Serviços prestados',
				codigoTributacao: cTribNac,
				codigoNbs: codigoNbs || undefined,
				cnae: effectiveCnae || undefined,
				municipioPrestacao: cLocPrestacao ? `${cLocPrestacao}` : `${munPrestador} - ${ufPrestador}`,
				valorServicos: vServico,
				valorLiquido: vServico - (valorDesconto > 0 ? valorDesconto : 0) - (totalRetFedNum > 0 ? totalRetFedNum : 0),
				valorDesconto: valorDesconto > 0 ? valorDesconto : undefined,
				descontoCondicionado: descontoCondicionado > 0 ? descontoCondicionado : undefined,
				valorDeducoes: valorDeducoes > 0 ? valorDeducoes : undefined,
				aliquotaIss: (aliquotaIss !== undefined && aliquotaIss > 0) ? aliquotaIss : undefined,
				retencaoIss: String(tpRetISSQN),
				valorIss: (aliquotaIss !== undefined && aliquotaIss > 0)
					? ((Math.max(0, vServico - (valorDeducoes > 0 ? valorDeducoes : 0) - (valorDesconto > 0 ? valorDesconto : 0)) * aliquotaIss) / 100)
					: undefined,
				regimeEspecialIss: regEspTrib ? String(regEspTrib) : undefined,
			},
			tributosFederais: totalRetFedNum > 0 ? {
				pis: retencaoPis,
				cofins: retencaoCofins,
				inss: retencaoInss,
				irrf: retencaoIrrf,
				csll: retencaoCsll,
				totalRetencoes: totalRetFedNum,
			} : undefined,
			ibscbs: (cstIbsCbs || cClassTrib) ? {
				cst: cstIbsCbs || '01',
				cClassTrib: cClassTrib || '000000',
			} : undefined,
			informacoesComplementares: finalInfoCompl || undefined,
		};

		const danfseParaRenderizar = emitirMascararDados ? maskDanfseData(emitDanfseData) : emitDanfseData;

		if (emitirGerarPdf) {
			const pdfBuffer = await DanfseGenerator.generatePdf(danfseParaRenderizar);
			if (!executionResult.binary) executionResult.binary = {};
			executionResult.binary.danfse = {
				data: pdfBuffer.toString('base64'),
				mimeType: 'application/pdf',
				fileName: `DANFSE-${numeroNfse}.pdf`,
				fileExtension: 'pdf',
			};
		}

		if (emitirGerarHtml) {
			const htmlContent = await DanfseHtmlGenerator.renderHtml(danfseParaRenderizar, '');
			if (!executionResult.binary) executionResult.binary = {};
			executionResult.binary.danfse_html = {
				data: Buffer.from(htmlContent, 'utf-8').toString('base64'),
				mimeType: 'text/html',
				fileName: `DANFSE-${numeroNfse}.html`,
				fileExtension: 'html',
			};
			(executionResult.json as Record<string, unknown>).danfseHtml = htmlContent;
		}
	}

	returnData.push(executionResult);

	return returnData;
}
