import * as zlib from 'zlib';

export interface DpsInputData {
	ambiente: number; // 1 = Produção, 2 = Homologação
	cLocEmi: string; // Código IBGE do município emissor (7 dígitos)
	serieDps?: string; // ex: '1'
	nDPS: string | number; // Número sequencial da DPS
	dCompet?: string; // yyyy-MM-dd
	dhEmi?: string; // ISO DateTime com timezone
	prestador: {
		cnpj: string;
		opSimpNac?: number; // 1 = Não Optante, 2 = Optante MEI, 3 = ME/EPP
		regApTribSN?: number;
		regEspTrib?: number;
	};
	tomador: {
		cpfCnpj?: string;
		cNIF?: string;
		im?: string;
		xNome: string;
		email?: string;
		telefone?: string;
		endereco?: {
			xLgr?: string;
			nro?: string;
			xCpl?: string;
			xBairro?: string;
			cMun?: string;
			uf?: string;
			cep?: string;
			cPais?: string;
			cEndPost?: string;
			xCid?: string;
			xEstProv?: string;
		};
	};
	servico: {
		cLocPrestacao?: string;
		cTribNac: string; // Código de Tributação Nacional (ex: 010301)
		cTribMun?: string; // Código Municipal do serviço
		cNBS?: string; // Código da NBS (ex: 1.0101.10.00 ou 101011000)
		cnae?: string; // CNAE 7 dígitos (ex: 5320202) - usado no DANFSe
		xDescServ: string;
	};
	intermediario?: {
		cpfCnpj?: string;
		xNome?: string;
		im?: string;
	};
	valores: {
		vServ: number | string;
		vDescIncond?: number | string; // Desconto incondicionado
		vDescCond?: number | string; // Desconto condicionado
		vDedRed?: number | string; // Dedução da base de cálculo
		tribISSQN?: number; // 1 = Operação tributável
		pAliq?: number | string; // Alíquota do ISS (ex: 2.00 a 5.00)
		tpRetISSQN?: number; // 1 = Não retido, 2 = Retido
		vISSQN?: number | string; // Valor do ISS apurado
		tribFed?: {
			vPIS?: number | string;
			vCOFINS?: number | string;
			vRetCSLL?: number | string;
			vRetIRRF?: number | string;
			vRetINSS?: number | string;
			tpRetPisCofins?: number; // 1 = Retido, 2 = Não retido
		};
	};
	ibscbs?: {
		finNFSe?: number; // 0 = Normal, 1 = Ajuste
		cIndOp?: string; // Código Indicador da Operação conforme LC 214/2025
		cst?: string; // Código de Situação Tributária
		cClassTrib?: string; // Código de Classificação Tributária
		pIBS?: number | string;
		vIBS?: number | string;
		pCBS?: number | string;
		vCBS?: number | string;
	};
	informacoesComplementares?: string; // Observações / infoCompl / xInfComp
	customTemplateXml?: string; // Permite sobrescrever o template XML completamente
	substituicao?: {
		chSubstda: string;
		cMotivo: string;
		xMotivo?: string;
	};
}

export class DpsBuilder {
	/**
	 * Gera o Id canônico de 42 dígitos da DPS
	 */
	public static buildDpsId(cLocEmi: string, cnpj: string, serie: string, nDPS: string | number): string {
		const cleanLoc = cLocEmi.replace(/\D/g, '').padStart(7, '0').slice(-7);
		const cleanCnpj = cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase().padStart(14, '0').slice(-14);
		const cleanSerie = serie.replace(/\D/g, '').padStart(5, '0').slice(-5);
		const cleanNum = String(nDPS).replace(/\D/g, '').padStart(15, '0').slice(-15);
		return `DPS${cleanLoc}2${cleanCnpj}${cleanSerie}${cleanNum}`;
	}

	/**
	 * Converte qualquer formato comum de data (DD/MM/AAAA, AAAA/MM/DD, DD-MM-AAAA, AAAA-MM-DD) para AAAA-MM-DD
	 */
	public static normalizeIsoDate(dateStr?: string): string {
		if (!dateStr || !dateStr.trim()) return '';
		const clean = dateStr.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
		const matchYmd = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
		if (matchYmd) {
			const [, y, m, d] = matchYmd;
			return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
		}
		const matchDmy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
		if (matchDmy) {
			const [, d, m, y] = matchDmy;
			return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
		}
		return clean;
	}

	/**
	 * Constrói o XML da DPS estritamente conforme XSD oficial da Receita Federal (v1.00 / v1.01)
	 */
	public static buildXml(data: DpsInputData): { xml: string; dpsId: string } {
		const cleanCnpj = data.prestador.cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		const serie = data.serieDps || '1';
		const numDpsStr = String(data.nDPS).replace(/\D/g, '');
		const dpsId = this.buildDpsId(data.cLocEmi, cleanCnpj, serie, numDpsStr);

		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/Sao_Paulo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
		const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
		const dhEmi = data.dhEmi || `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
		const todayIso = `${parts.year}-${parts.month}-${parts.day}`;
		const dCompet = data.dCompet ? (this.normalizeIsoDate(data.dCompet) || todayIso) : todayIso;

		// Se o usuário forneceu um template customizado, interpola variáveis básicas
		if (data.customTemplateXml && data.customTemplateXml.trim()) {
			let customXml = data.customTemplateXml;
			customXml = customXml.replace(/\{\{\s*\$dpsId\s*\}\}/g, dpsId);
			customXml = customXml.replace(/\{\{\s*\$dhEmi\s*\}\}/g, dhEmi);
			customXml = customXml.replace(/\{\{\s*\$dCompet\s*\}\}/g, dCompet);
			customXml = customXml.replace(/\{\{\s*\$nDPS\s*\}\}/g, numDpsStr);
			customXml = customXml.replace(/\{\{\s*\$cLocEmi\s*\}\}/g, data.cLocEmi);
			customXml = customXml.replace(/\{\{\s*\$cnpjPrestador\s*\}\}/g, cleanCnpj);
			customXml = customXml.replace(/\{\{\s*\$vServ\s*\}\}/g, Number(data.valores.vServ).toFixed(2));
			return { xml: customXml, dpsId };
		}

		// Tomador Documento (CNPJ, CPF ou NIF exterior conforme TCInfoPessoa)
		let tagDocToma = '';
		if (data.tomador.cNIF && data.tomador.cNIF.trim()) {
			tagDocToma = `<NIF>${this.escapeXml(data.tomador.cNIF.trim())}</NIF>`;
		} else if (data.tomador.cpfCnpj) {
			const docToma = data.tomador.cpfCnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
			const isCnpj = docToma.length > 11;
			tagDocToma = isCnpj ? `<CNPJ>${docToma}</CNPJ>` : `<CPF>${docToma}</CPF>`;
		}

		let tagImToma = '';
		if (data.tomador.im && data.tomador.im.trim()) {
			tagImToma = `\n            <IM>${this.escapeXml(data.tomador.im.trim())}</IM>`;
		}

		const safeNomeToma = this.escapeXml(data.tomador.xNome || 'Tomador');
		const safeDesc = this.escapeXml(data.servico.xDescServ || 'Prestacao de servicos');
		const vServ = Number(data.valores.vServ).toFixed(2);
		const cLocPrest = data.servico.cLocPrestacao ? data.servico.cLocPrestacao.replace(/\D/g, '') : data.cLocEmi;
		const opSimpNac = data.prestador.opSimpNac || 3; // 3 = Optante Simples Nacional ME/EPP
		const regApTribSN = data.prestador.regApTribSN || (opSimpNac === 2 ? 1 : 2);
		const regEspTrib = data.prestador.regEspTrib || 0;

		// Endereço Tomador conforme TCEndereco oficial (end -> endNac ou endExt)
		let tagEnder = '';
		if (data.tomador.endereco && (data.tomador.endereco.xLgr || data.tomador.endereco.cep || data.tomador.endereco.xBairro || data.tomador.endereco.nro || data.tomador.endereco.cPais || data.tomador.endereco.xCid)) {
			const end = data.tomador.endereco;
			const isExterior = Boolean(end.cPais || end.cEndPost || end.xCid || (data.tomador.cNIF && !end.cMun));
			const xCplTag = end.xCpl && end.xCpl.trim() ? `\n                <xCpl>${this.escapeXml(end.xCpl.trim())}</xCpl>` : '';
			if (isExterior) {
				const cPais = (end.cPais || '999').replace(/\D/g, '');
				const cEndPost = this.escapeXml(end.cEndPost || end.cep || '00000');
				const xCid = this.escapeXml(end.xCid || 'Exterior');
				const xEstProv = this.escapeXml(end.xEstProv || end.uf || 'EX');
				tagEnder = `
            <end>
                <endExt>
                    <cPais>${cPais}</cPais>
                    <cEndPost>${cEndPost}</cEndPost>
                    <xCid>${xCid}</xCid>
                    <xEstProv>${xEstProv}</xEstProv>
                </endExt>
                <xLgr>${this.escapeXml(end.xLgr || 'Endereco')}</xLgr>
                <nro>${this.escapeXml(end.nro || 'S/N')}</nro>${xCplTag}
                <xBairro>${this.escapeXml(end.xBairro || 'Bairro')}</xBairro>
            </end>`;
			} else {
				const cMunToma = (end.cMun || data.cLocEmi).replace(/\D/g, '');
				const cepToma = (end.cep || '').replace(/\D/g, '');
				tagEnder = `
            <end>
                <endNac>
                    <cMun>${cMunToma}</cMun>
                    <CEP>${cepToma || '00000000'}</CEP>
                </endNac>
                <xLgr>${this.escapeXml(end.xLgr || 'Endereco')}</xLgr>
                <nro>${this.escapeXml(end.nro || 'S/N')}</nro>${xCplTag}
                <xBairro>${this.escapeXml(end.xBairro || 'Centro')}</xBairro>
            </end>`;
			}
		}

		// Telefone Tomador conforme TSTelefone (somente dígitos de 6 a 20)
		let tagFone = '';
		if (data.tomador.telefone) {
			const cleanTel = data.tomador.telefone.replace(/\D/g, '');
			if (cleanTel.length >= 6) {
				tagFone = `
            <fone>${cleanTel}</fone>`;
			}
		}

		// Email Tomador
		let tagEmail = '';
		if (data.tomador.email && data.tomador.email.includes('@')) {
			tagEmail = `
            <email>${this.escapeXml(data.tomador.email.trim())}</email>`;
		}

		// Código Municipal do Serviço (opcional)
		let tagCTribMun = '';
		if (data.servico.cTribMun && data.servico.cTribMun.trim()) {
			tagCTribMun = `
                <cTribMun>${this.escapeXml(data.servico.cTribMun.trim())}</cTribMun>`;
		}

		// Código NBS (opcional conforme SEFIN)
		let tagCNBS = '';
		if (data.servico.cNBS && data.servico.cNBS.trim()) {
			const cleanNbs = data.servico.cNBS.replace(/\D/g, '').slice(0, 9);
			if (cleanNbs) {
				tagCNBS = `
                <cNBS>${cleanNbs}</cNBS>`;
			}
		}

		// Informações Complementares conforme TCInfoCompl (dentro de <serv><infoCompl><xInfComp>)
		let tagInfoCompl = '';
		if (data.informacoesComplementares && data.informacoesComplementares.trim()) {
			tagInfoCompl = `
            <infoCompl>
                <xInfComp>${this.escapeXml(data.informacoesComplementares.trim())}</xInfComp>
            </infoCompl>`;
		}

		// Descontos conforme TCVDescCondIncond (vDescIncond e vDescCond)
		let tagDescCondIncond = '';
		const hasDescIncond = data.valores.vDescIncond && Number(data.valores.vDescIncond) > 0;
		const hasDescCond = data.valores.vDescCond && Number(data.valores.vDescCond) > 0;
		if (hasDescIncond || hasDescCond) {
			const subTags: string[] = [];
			if (hasDescIncond) {
				subTags.push(`<vDescIncond>${Number(data.valores.vDescIncond).toFixed(2)}</vDescIncond>`);
			}
			if (hasDescCond) {
				subTags.push(`<vDescCond>${Number(data.valores.vDescCond).toFixed(2)}</vDescCond>`);
			}
			tagDescCondIncond = `
            <vDescCondIncond>
                ${subTags.join('\n                ')}
            </vDescCondIncond>`;
		}

		// Intermediário da Operação (opcional conforme TCInfoPessoa)
		let tagInterm = '';
		if (data.intermediario && (data.intermediario.cpfCnpj || data.intermediario.xNome)) {
			const cleanDoc = (data.intermediario.cpfCnpj || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
			const isCnpj = cleanDoc.length > 11;
			const docTag = cleanDoc ? (isCnpj ? `<CNPJ>${cleanDoc}</CNPJ>` : `<CPF>${cleanDoc}</CPF>`) : '';
			const imTag = data.intermediario.im ? `\n            <IM>${this.escapeXml(data.intermediario.im)}</IM>` : '';
			tagInterm = `
        <interm>
            ${docTag}${imTag}
            <xNome>${this.escapeXml(data.intermediario.xNome || 'Intermediario')}</xNome>
        </interm>`;
		}

		// Dedução / Ajuste da base de cálculo (conforme TCInfoAjusteBC - NT 009)
		let tagDed = '';
		if (data.valores.vDedRed && Number(data.valores.vDedRed) > 0) {
			tagDed = `
            <vAjusteBC>
                <vAjusteBCISSQN>${Number(data.valores.vDedRed).toFixed(2)}</vAjusteBCISSQN>
            </vAjusteBC>`;
		}

		// Retenções Tributárias Federais conforme TCTribFederal (piscofins -> vRetCP -> vRetIRRF -> vRetCSLL)
		let tagTribFed = '';
		if (data.valores.tribFed) {
			const tf = data.valores.tribFed;
			const parts: string[] = [];
			if (tf.vPIS || tf.vCOFINS) {
				const vPis = Number(tf.vPIS || 0).toFixed(2);
				const vCof = Number(tf.vCOFINS || 0).toFixed(2);
				const tpRet = tf.tpRetPisCofins || 1;
				parts.push(`
                    <piscofins>
                        <CST>01</CST>
                        <vPis>${vPis}</vPis>
                        <vCofins>${vCof}</vCofins>
                        <tpRetPisCofins>${tpRet}</tpRetPisCofins>
                    </piscofins>`);
			}
			if (tf.vRetINSS && Number(tf.vRetINSS) > 0) {
				parts.push(`
                    <vRetCP>${Number(tf.vRetINSS).toFixed(2)}</vRetCP>`);
			}
			if (tf.vRetIRRF && Number(tf.vRetIRRF) > 0) {
				parts.push(`
                    <vRetIRRF>${Number(tf.vRetIRRF).toFixed(2)}</vRetIRRF>`);
			}
			if (tf.vRetCSLL && Number(tf.vRetCSLL) > 0) {
				parts.push(`
                    <vRetCSLL>${Number(tf.vRetCSLL).toFixed(2)}</vRetCSLL>`);
			}
			if (parts.length > 0) {
				tagTribFed = `
                <tribFed>${parts.join('')}
                </tribFed>`;
			}
		}

		// Reforma Tributária do Consumo (RTC / NT 009 v1.01 - TCRTCInfoIBSCBS)
		let tagIbscbs = '';
		if (data.ibscbs && (data.ibscbs.cst || data.ibscbs.cClassTrib || data.ibscbs.cIndOp)) {
			tagIbscbs = `
        <IBSCBS>
            <cIndOp>${this.escapeXml(data.ibscbs.cIndOp || '010101')}</cIndOp>
            <indDest>0</indDest>
            <valores>
                <trib>
                    <CST>${this.escapeXml(data.ibscbs.cst || '000')}</CST>
                    <cClassTrib>${this.escapeXml(data.ibscbs.cClassTrib || '000001')}</cClassTrib>
                </trib>
            </valores>
        </IBSCBS>`;
		}

		let tagSubst = '';
		if (data.substituicao && data.substituicao.chSubstda) {
			const xMotivoTag = data.substituicao.xMotivo ? `\n            <xMotivo>${this.escapeXml(data.substituicao.xMotivo)}</xMotivo>` : '';
			tagSubst = `
        <subst>
            <chSubstda>${data.substituicao.chSubstda}</chSubstda>
            <cMotivo>${data.substituicao.cMotivo}</cMotivo>${xMotivoTag}
        </subst>`;
		}

		// Alíquota do ISS municipal (conforme TCTribMunicipal oficial: tribISSQN -> tpRetISSQN -> pAliq)
		let tagAliq = '';
		if (data.valores.pAliq !== undefined && data.valores.pAliq !== '' && Number(data.valores.pAliq) > 0) {
			const aliqNum = Number(data.valores.pAliq);
			tagAliq = `\n                    <pAliq>${aliqNum.toFixed(2)}</pAliq>`;
		}

		const finNFSe = data.ibscbs?.finNFSe ?? 0;

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
    <infDPS Id="${dpsId}">
        <tpAmb>${data.ambiente}</tpAmb>
        <dhEmi>${dhEmi}</dhEmi>
        <verAplic>N8N-NFSE-1.0</verAplic>
        <serie>${serie}</serie>
        <nDPS>${numDpsStr}</nDPS>
        <dCompet>${dCompet}</dCompet>
        <tpEmit>1</tpEmit>
        <finNFSe>${finNFSe}</finNFSe>
        <cLocEmi>${data.cLocEmi}</cLocEmi>${tagSubst}
        <prest>
            <CNPJ>${cleanCnpj}</CNPJ>
            <regTrib>
                <opSimpNac>${opSimpNac}</opSimpNac>
                ${(opSimpNac === 1 || opSimpNac === 2) ? '' : `<regApTribSN>${regApTribSN}</regApTribSN>`}
                <regEspTrib>${regEspTrib}</regEspTrib>
            </regTrib>
        </prest>
        <toma>
            ${tagDocToma}${tagImToma}
            <xNome>${safeNomeToma}</xNome>${tagEnder}${tagFone}${tagEmail}
        </toma>${tagInterm}
        <serv>
            <locPrest>
                <cLocPrestacao>${cLocPrest}</cLocPrestacao>
            </locPrest>
            <cServ>
                <cTribNac>${data.servico.cTribNac}</cTribNac>${tagCTribMun}${tagCNBS}
                <xDescServ>${safeDesc}</xDescServ>
            </cServ>${tagInfoCompl}
        </serv>
        <valores>
            <vServPrest>
                <vServ>${vServ}</vServ>
            </vServPrest>${tagDescCondIncond}${tagDed}
            <trib>
                <tribMun>
                    <tribISSQN>${data.valores.tribISSQN || 1}</tribISSQN>
                    <tpRetISSQN>${data.valores.tpRetISSQN || 1}</tpRetISSQN>${tagAliq}
                </tribMun>${tagTribFed}
                <totTrib>
                    ${opSimpNac === 3 ? '<pTotTribSN>0.00</pTotTribSN>' : '<indTotTrib>0</indTotTrib>'}
                </totTrib>
            </trib>
        </valores>${tagIbscbs}
    </infDPS>
</DPS>`;

		return { xml, dpsId };
	}

	/**
	 * Compacta o XML assinado em GZIP e codifica em Base64 para o payload da SEFIN Nacional
	 */
	public static compressXmlToGzipB64(signedXml: string): string {
		const buffer = Buffer.from(signedXml, 'utf-8');
		const gzipped = zlib.gzipSync(buffer);
		return gzipped.toString('base64');
	}

	/**
	 * Descompacta o XML retornado pela SEFIN Nacional em GZIP Base64
	 */
	public static decompressGzipB64ToXml(gzipB64: string): string {
		const buffer = Buffer.from(gzipB64, 'base64');
		const decompressed = zlib.gunzipSync(buffer);
		return decompressed.toString('utf-8');
	}

	private static escapeXml(unsafe: string): string {
		return unsafe
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}
}
