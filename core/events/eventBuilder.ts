import * as zlib from 'zlib';

export interface CancelamentoInputData {
	ambiente: number | string;
	chaveAcesso: string;
	cMotivo: '1' | '2' | '9' | string;
	xMotivo: string;
	autorCpfCnpj?: string;
	dhEvento?: string;
}

export class EventBuilder {
	/**
	 * Constrói o XML oficial do Pedido de Registro de Evento (pedRegEvento v1.01) para Cancelamento (101101)
	 * Conforme especificação oficial RTC v1.01 da SEFIN Nacional:
	 * - Id: PRE + 50 caracteres da chave + 6 dígitos do evento (101101) = 59 caracteres (Pattern TSIdPedRegEvt)
	 * - nPedRegEvento e tpEvento removidos per Anexo II do SEFIN_ADN
	 * - Elemento e101101 com xDesc, cMotivo e xMotivo
	 */
	public static buildCancelamentoXml(data: CancelamentoInputData): { xml: string; pedRegId: string } {
		const cleanKey = data.chaveAcesso.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		const tipoEvento = '101101';
		const pedRegId = `PRE${cleanKey}${tipoEvento}`;

		// Identifica o autor (CNPJ ou CPF)
		let autorDoc = (data.autorCpfCnpj || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		let isCnpj = autorDoc.length > 11;
		if (!autorDoc && cleanKey.length === 50) {
			const tpInsc = cleanKey.charAt(8);
			if (tpInsc === '2') {
				autorDoc = cleanKey.substring(9, 23);
				isCnpj = true;
			} else {
				autorDoc = cleanKey.substring(12, 23);
				isCnpj = false;
			}
		}

		const autorXml = isCnpj
			? `<CNPJAutor>${autorDoc}</CNPJAutor>`
			: `<CPFAutor>${autorDoc}</CPFAutor>`;

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
		const dhEvento = data.dhEvento || `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;

		const safeXMotivo = this.escapeXml(data.xMotivo.trim());

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
    <infPedReg Id="${pedRegId}">
        <tpAmb>${data.ambiente}</tpAmb>
        <verAplic>N8N-NFSE-1.0</verAplic>
        <dhEvento>${dhEvento}</dhEvento>
        ${autorXml}
        <chNFSe>${cleanKey}</chNFSe>
        <e101101>
            <xDesc>Cancelamento de NFS-e</xDesc>
            <cMotivo>${data.cMotivo || '1'}</cMotivo>
            <xMotivo>${safeXMotivo}</xMotivo>
        </e101101>
    </infPedReg>
</pedRegEvento>`;

		return { xml, pedRegId };
	}

	/**
	 * Compacta o XML do evento em GZIP e codifica em Base64
	 */
	public static compressXmlToGzipB64(signedXml: string): string {
		const buffer = Buffer.from(signedXml, 'utf-8');
		const gzipped = zlib.gzipSync(buffer);
		return gzipped.toString('base64');
	}

	/**
	 * Descompacta GZIP Base64 para XML em texto puro (com suporte a double-base64 da SEFIN)
	 */
	public static decompressGzipB64ToXml(gzipB64: string): string {
		try {
			let buffer = Buffer.from(gzipB64, 'base64');
			const preview = buffer.toString('utf-8', 0, 10);
			if (preview.startsWith('H4sI')) {
				buffer = Buffer.from(buffer.toString('utf-8'), 'base64');
			}
			const decompressed = zlib.gunzipSync(buffer);
			return decompressed.toString('utf-8');
		} catch {
			return '';
		}
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
