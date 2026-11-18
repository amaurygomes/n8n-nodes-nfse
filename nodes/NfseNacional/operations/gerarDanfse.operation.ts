import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationContext } from './types';
import { DpsBuilder } from '../../../core/dps/dpsBuilder';
import { SefinClient } from '../../../core/client/sefinClient';
import { DanfseGenerator, type DanfseData, unescapeXml, maskDanfseData } from '../../../core/danfse/danfseGenerator';
import { DanfseHtmlGenerator } from '../../../core/danfse/danfseHtmlGenerator';
import { parseSefinResponseBody } from '../helpers/sefinResponse';

export async function gerarDanfse(this: IExecuteFunctions, i: number, ctx: OperationContext): Promise<INodeExecutionData[]> {
	const { items, credentials, certHolder, prestadorCnpj, codigoMunicipio, ambiente, customUrl, credRazaoSocial, credMunicipioNome, inscricaoMunicipal, credCnaePrincipal, credRegimeTributario, formatDanfseUrl } = ctx;
	const returnData: INodeExecutionData[] = [];

	const inputItem = items[i]?.json as Record<string, unknown> | undefined;
	const modoDanfse = this.getNodeParameter('modoDanfse', i, 'automatico') as string;
	const rawChave = (this.getNodeParameter('danfseChave', i, '') as string).trim();
	const chave = rawChave || (typeof inputItem?.chaveAcesso === 'string' ? inputItem.chaveAcesso.trim() : '');
	const formato = this.getNodeParameter('danfseFormato', i, 'pdf') as 'pdf' | 'html' | 'ambos';
	const danfseOpcoes = modoDanfse === 'automatico'
		? {
			...(this.getNodeParameter('danfseOpcoes', i, {}) as Record<string, unknown>),
			...(this.getNodeParameter('danfseOpcoesAuto', i, {}) as Record<string, unknown>),
		}
		: (this.getNodeParameter('danfseOpcoes', i, {}) as Record<string, unknown>) || {};
	const timeoutMs = (danfseOpcoes.timeoutMs as number) || 25000;
	const rejectUnauthorized = danfseOpcoes.rejectUnauthorized !== true;
	const danfseMascararDados = danfseOpcoes.mascararDadosSigilosos === true;

	let danfseData: DanfseData;
	let numeroNfseFinal = '';
	let statusFinal = 'AUTORIZADA';

	if (modoDanfse === 'automatico') {
		const rawXmlParam = (this.getNodeParameter('danfseXmlAutorizado', i, '') as string).trim();
		let xmlAutorizado =
			rawXmlParam ||
			(typeof inputItem?.xmlNfseAutorizado === 'string' ? inputItem.xmlNfseAutorizado : '') ||
			(typeof inputItem?.xmlNfse === 'string' ? inputItem.xmlNfse : '');
		let isCanceladaDetectada = false;

		// 1. Detectar se o nó anterior no workflow for um cancelamento ou indicar status CANCELADA:
		if (inputItem) {
			if (
				inputItem.status === 'CANCELADA' ||
				Boolean(inputItem.pedRegId) ||
				Boolean(inputItem.jaEstavaCancelada) ||
				(typeof inputItem.mensagemRetorno === 'string' && inputItem.mensagemRetorno.toLowerCase().includes('cancel'))
			) {
				isCanceladaDetectada = true;
			}
		}

		// Se o usuário passou apenas o XML do evento de cancelamento (<pedRegEvento> ou <e101101>) no campo xmlAutorizado:
		if (xmlAutorizado && (xmlAutorizado.includes('<pedRegEvento') || xmlAutorizado.includes('<e101101>')) && !xmlAutorizado.includes('<infDPS') && !xmlAutorizado.includes('<infNFSe')) {
			isCanceladaDetectada = true;
			xmlAutorizado = '';
		}

		// Se não foi fornecido o XML (ou era apenas o evento), consulta a SEFIN via mTLS com o certificado A1
		if (!xmlAutorizado || !xmlAutorizado.trim()) {
			if (!chave) {
				throw new NodeOperationError(
					this.getNode(),
					'Chave de acesso é obrigatória para consultar a nota na SEFIN Nacional.',
					{ itemIndex: i },
				);
			}
			const client = new SefinClient({
				ambiente,
				customUrl,
				privateKeyPem: certHolder.privateKeyPem,
				certificatePem: certHolder.certificatePem,
				timeoutMs,
				rejectUnauthorized,
			});

			const response = await client.consultarNfsePorChave(chave);
			if (response.body && response.body.nfseXmlGZipB64) {
				try {
					xmlAutorizado = DpsBuilder.decompressGzipB64ToXml(response.body.nfseXmlGZipB64 as string);
				} catch {
					// ignored
				}
			}

			if (!xmlAutorizado) {
				const treated = parseSefinResponseBody(response.body, response.statusCode);
				throw new NodeOperationError(
					this.getNode(),
					`Não foi possível obter o XML autorizado da SEFIN Nacional para a chave ${chave}. Motivo: ${treated.mensagemRetorno || 'Resposta sem XML'} (Status HTTP ${response.statusCode})`,
					{ itemIndex: i },
				);
			}

			// Se ainda não detectou cancelamento, verifica na SEFIN se existe evento de cancelamento 101101
			if (!isCanceladaDetectada) {
				try {
					const evtResp = await client.consultarEventos(chave, '101101', 1);
					const bodyObj = typeof evtResp.body === 'object' && evtResp.body !== null ? (evtResp.body as Record<string, unknown>) : null;
					const hasErrors = bodyObj && Array.isArray(bodyObj.erros) && bodyObj.erros.length > 0;
					const temEventoCancelamento = bodyObj && Array.isArray(bodyObj.eventos) && (bodyObj.eventos as Array<Record<string, unknown>>).some((e) => String(e.tipoEvento) === '101101');
					if (evtResp.statusCode === 200 && (!hasErrors || temEventoCancelamento)) {
						isCanceladaDetectada = true;
					}
				} catch {
					// sem evento
				}
			}
		}

		// Extrai dados completos do xmlAutorizado
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
		const cNumNfse = xmlAutorizado.match(/<nNFSe>([^<]+)<\/nNFSe>/i)?.[1] || '0';
		const cSerie = xmlAutorizado.match(/<(?:sDPS|serie)>([^<]+)<\/(?:sDPS|serie)>/i)?.[1];
		const cDpsNum = xmlAutorizado.match(/<nDPS>([^<]+)<\/nDPS>/i)?.[1];
		numeroNfseFinal = cNumNfse;

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

		const isCanceladaNoXml = /<e101101/i.test(xmlAutorizado) ||
			/<pedRegEvento/i.test(xmlAutorizado) ||
			/<infPedCanc/i.test(xmlAutorizado) ||
			/<canc/i.test(xmlAutorizado) ||
			/Cancelamento de NFS-e/i.test(xmlAutorizado) ||
			/<tpEvento>101101<\/tpEvento>/i.test(xmlAutorizado);

		const statusOverride = (danfseOpcoes.danfseStatusOverride as string) || 'AUTO';
		let isCanceladaFinal = false;
		if (statusOverride === 'CANCELADA') {
			isCanceladaFinal = true;
		} else if (statusOverride === 'AUTORIZADA') {
			isCanceladaFinal = false;
		} else {
			isCanceladaFinal = isCanceladaDetectada || isCanceladaNoXml;
		}
		statusFinal = isCanceladaFinal ? 'CANCELADA' : 'AUTORIZADA';

		danfseData = {
			numeroNfse: cNumNfse,
			serie: cSerie,
			dpsNumero: cDpsNum,
			chaveAcesso: chave,
			dataEmissao: new Date().toLocaleDateString('pt-BR'),
			competencia: comp,
			ambiente: ambiente === '1' ? 'Produção' : 'Homologação',
			status: statusFinal,
			prestador: {
				razaoSocial: emitNome,
				cnpj: prestadorCnpj,
				codigoIbge: codigoMunicipio,
				inscricaoMunicipal: inscricaoMunicipal || undefined,
				municipio: munPrest,
				uf: ufPrest,
				logradouro: matchEmitLgr ? unescapeXml(matchEmitLgr[1].trim()) : (credentials.prestadorEndereco as string) || undefined,
				numero: matchEmitNro ? unescapeXml(matchEmitNro[1].trim()) : undefined,
				bairro: matchEmitBairro ? unescapeXml(matchEmitBairro[1].trim()) : undefined,
				cep: matchEmitCep ? matchEmitCep[1].trim() : (credentials.prestadorCep as string) || undefined,
				email: (credentials.prestadorEmail as string) || undefined,
				telefone: (credentials.prestadorTelefone as string) || undefined,
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
			informacoesComplementares: cInfComp || (danfseOpcoes.informacoesComplementares ? unescapeXml(danfseOpcoes.informacoesComplementares as string) : undefined),
		};
	} else {
		statusFinal = this.getNodeParameter('danfseStatus', i, 'AUTORIZADA') as string;
		numeroNfseFinal = this.getNodeParameter('danfseNumero', i) as string;
		const tomador = this.getNodeParameter('danfseTomadorNome', i) as string;
		const doc = this.getNodeParameter('danfseTomadorDoc', i) as string;
		const valor = this.getNodeParameter('danfseValor', i) as number;
		const desc = this.getNodeParameter('danfseDescricao', i) as string;

		const tomadorBairro = (danfseOpcoes.tomadorBairro as string) || '';
		const tomadorCep = (danfseOpcoes.tomadorCep as string) || '';
		const tomadorLogradouro = (danfseOpcoes.tomadorLogradouro as string) || '';
		const tomadorNumero = (danfseOpcoes.tomadorNumero as string) || '';
		const tomadorTelefone = (danfseOpcoes.tomadorTelefone as string) || '';
		const tomadorEmail = (danfseOpcoes.tomadorEmail as string) || '';
		const tomadorMunicipioNome = (danfseOpcoes.tomadorMunicipioNome as string || '').trim();
		const cLocPrestacao = (danfseOpcoes.cLocPrestacao as string) || '';
		const codigoTributacao = (danfseOpcoes.codigoTributacao as string) || '';
		const cnaeParam = (danfseOpcoes.cnae as string) || '';
		const valorDesconto = (danfseOpcoes.valorDesconto as number) || 0;
		const valorDeducoes = (danfseOpcoes.valorDeducoes as number) || 0;
		const destinatarioNome = (danfseOpcoes.destinatarioNome as string) || '';
		const destinatarioCpfCnpj = (danfseOpcoes.destinatarioCpfCnpj as string) || '';
		const intermediarioNome = (danfseOpcoes.intermediarioNome as string) || '';
		const intermediarioCpfCnpj = (danfseOpcoes.intermediarioCpfCnpj as string) || '';
		const retencaoPis = (danfseOpcoes.retencaoPis as number) || 0;
		const retencaoCofins = (danfseOpcoes.retencaoCofins as number) || 0;
		const retencaoInss = (danfseOpcoes.retencaoInss as number) || 0;
		const retencaoIrrf = (danfseOpcoes.retencaoIrrf as number) || 0;
		const retencaoCsll = (danfseOpcoes.retencaoCsll as number) || 0;
		const totalRetFedManual = retencaoPis + retencaoCofins + retencaoInss + retencaoIrrf + retencaoCsll;
		const cstIbsCbs = (danfseOpcoes.cstIbsCbs as string) || '';
		const cClassTrib = (danfseOpcoes.cClassTrib as string) || '';
		const informacoesComplementares = (danfseOpcoes.informacoesComplementares as string) || '';
		const dataCompetencia = (danfseOpcoes.dataCompetencia as string) || '';
		const descontoCondicionado = Number(danfseOpcoes.descontoCondicionado || 0);
		const codigoNbs = ((danfseOpcoes.codigoNbs as string) || '').trim();
		const regEspTrib = Number(danfseOpcoes.regEspTrib ?? 0);
		const tomadorComplemento = ((danfseOpcoes.tomadorComplemento as string) || '').trim();
		const tomadorInscricaoMunicipal = ((danfseOpcoes.tomadorInscricaoMunicipal as string) || '').trim();
		const intermediarioIm = ((danfseOpcoes.intermediarioIm as string) || '').trim();

		const parts = credMunicipioNome.split('-').map((s) => s.trim());
		const munPrestador = parts[0] || '';
		const ufPrestador = parts[1] || '';

		let tomadorMunFinal = '';
		let tomadorUfFinal = '';
		if (tomadorMunicipioNome) {
			const tParts = tomadorMunicipioNome.split('-').map((s) => s.trim());
			tomadorMunFinal = tParts[0] || '';
			tomadorUfFinal = tParts[1] || '';
		}

		danfseData = {
			numeroNfse: numeroNfseFinal,
			chaveAcesso: chave,
			status: statusFinal,
			dataEmissao: new Date().toLocaleDateString('pt-BR'),
			competencia: dataCompetencia || undefined,
			ambiente: ambiente === '1' ? 'Produção' : 'Homologação',
			prestador: {
				razaoSocial: credRazaoSocial || certHolder.subject,
				cnpj: prestadorCnpj,
				codigoIbge: codigoMunicipio,
				inscricaoMunicipal: inscricaoMunicipal || undefined,
				municipio: munPrestador,
				uf: ufPrestador,
				logradouro: (credentials.prestadorEndereco as string) || undefined,
				cep: (credentials.prestadorCep as string) || undefined,
				email: (credentials.prestadorEmail as string) || undefined,
				telefone: (credentials.prestadorTelefone as string) || undefined,
				opSimpNac: Number(credRegimeTributario || 3),
			},
			tomador: {
				nome: unescapeXml(tomador) || 'Consumidor Final',
				cpfCnpj: doc,
				email: unescapeXml(tomadorEmail) || undefined,
				telefone: tomadorTelefone || undefined,
				logradouro: unescapeXml(tomadorLogradouro) || undefined,
				numero: unescapeXml(tomadorNumero) || undefined,
				complemento: unescapeXml(tomadorComplemento) || undefined,
				bairro: unescapeXml(tomadorBairro) || undefined,
				cep: tomadorCep || undefined,
				municipio: tomadorMunFinal || undefined,
				uf: tomadorUfFinal || undefined,
				inscricaoMunicipal: unescapeXml(tomadorInscricaoMunicipal) || undefined,
			},
			destinatario: (destinatarioCpfCnpj || destinatarioNome) ? {
				cpfCnpj: destinatarioCpfCnpj || undefined,
				nome: destinatarioNome || undefined,
			} : undefined,
			intermediario: (intermediarioCpfCnpj || intermediarioNome) ? {
				cpfCnpj: intermediarioCpfCnpj || undefined,
				nome: intermediarioNome || undefined,
				inscricaoMunicipal: unescapeXml(intermediarioIm) || undefined,
			} : undefined,
			servico: {
				descricao: unescapeXml(desc) || 'Prestação de serviços profissionais.',
				codigoTributacao,
				codigoNbs: codigoNbs || undefined,
				cnae: (cnaeParam || credCnaePrincipal || '').trim() || undefined,
				municipioPrestacao: cLocPrestacao || `${munPrestador} - ${ufPrestador}`,
				valorServicos: valor,
				valorLiquido: valor - (valorDesconto > 0 ? valorDesconto : 0) - (totalRetFedManual > 0 ? totalRetFedManual : 0),
				valorDesconto: valorDesconto > 0 ? valorDesconto : undefined,
				descontoCondicionado: descontoCondicionado > 0 ? descontoCondicionado : undefined,
				valorDeducoes: valorDeducoes > 0 ? valorDeducoes : undefined,
				regimeEspecialIss: regEspTrib ? String(regEspTrib) : undefined,
			},
			tributosFederais: totalRetFedManual > 0 ? {
				pis: retencaoPis,
				cofins: retencaoCofins,
				inss: retencaoInss,
				irrf: retencaoIrrf,
				csll: retencaoCsll,
				totalRetencoes: totalRetFedManual,
			} : undefined,
			ibscbs: (cstIbsCbs || cClassTrib) ? {
				cst: cstIbsCbs || '01',
				cClassTrib: cClassTrib || '000000',
			} : undefined,
			informacoesComplementares: informacoesComplementares ? unescapeXml(informacoesComplementares) : undefined,
		};
	}

	const danfseParaRenderizar = danfseMascararDados ? maskDanfseData(danfseData) : danfseData;

	let htmlContent = '';
	if (formato === 'html' || formato === 'ambos') {
		htmlContent = await DanfseHtmlGenerator.renderHtml(danfseParaRenderizar);
	}

	const danfseResult: INodeExecutionData = {
		pairedItem: { item: i },
		json: {
			sucesso: true,
			chaveAcesso: chave,
			numeroNfse: numeroNfseFinal,
			status: statusFinal,
			danfseUrl: formatDanfseUrl(chave),
			danfseHtml: htmlContent || null,
		},
	};

	if (formato === 'pdf' || formato === 'ambos') {
		const pdfBuffer = await DanfseGenerator.generatePdf(danfseParaRenderizar);
		danfseResult.binary = {
			danfse: {
				data: pdfBuffer.toString('base64'),
				mimeType: 'application/pdf',
				fileName: `DANFSE-${numeroNfseFinal || chave}.pdf`,
				fileExtension: 'pdf',
			},
		};
	}

	if ((formato === 'html' || formato === 'ambos') && htmlContent) {
		if (!danfseResult.binary) danfseResult.binary = {};
		danfseResult.binary.danfse_html = {
			data: Buffer.from(htmlContent, 'utf-8').toString('base64'),
			mimeType: 'text/html',
			fileName: `DANFSE-${numeroNfseFinal || chave}.html`,
			fileExtension: 'html',
		};
	}

	returnData.push(danfseResult);

	return returnData;
}
