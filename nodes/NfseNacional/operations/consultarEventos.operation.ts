import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { OperationContext } from './types';
import { EventBuilder } from '../../../core/events/eventBuilder';
import { SefinClient } from '../../../core/client/sefinClient';
import { parseSefinResponseBody } from '../helpers/sefinResponse';

export async function consultarEventos(this: IExecuteFunctions, i: number, ctx: OperationContext): Promise<INodeExecutionData[]> {
	const { certHolder, ambiente, customUrl, formatDanfseUrl } = ctx;
	const returnData: INodeExecutionData[] = [];

	const chaveAcesso = this.getNodeParameter('chaveAcessoEventos', i) as string;
	const eventosOpcoes = (this.getNodeParameter('eventosOpcoes', i, {}) as Record<string, unknown>) || {};
	const eventosTimeoutMs = (eventosOpcoes.timeoutMs as number) || 25000;
	const eventosRejectUnauth = eventosOpcoes.rejectUnauthorized !== true;
	const tipoEvento = (eventosOpcoes.tipoEvento as string) || '101101';
	const numSeqEvento = (eventosOpcoes.numSeqEvento as string | number) || '1';

	const client = new SefinClient({
		ambiente,
		customUrl,
		privateKeyPem: certHolder.privateKeyPem,
		certificatePem: certHolder.certificatePem,
		timeoutMs: eventosTimeoutMs,
		rejectUnauthorized: eventosRejectUnauth,
	});

	let response = await client.consultarEventos(chaveAcesso, tipoEvento, numSeqEvento);
	if (response.statusCode === 404 && String(numSeqEvento) === '1') {
		const retryResp = await client.consultarEventos(chaveAcesso, tipoEvento, '001');
		if (retryResp.statusCode === 200) {
			response = retryResp;
		}
	}
	const treated = parseSefinResponseBody(response.body, response.statusCode);

	let xmlEvento = '';
	if (typeof response.body === 'object' && response.body !== null) {
		const respBody = response.body as Record<string, unknown>;
		let rawXmlGzip = '';
		if (typeof respBody.eventoXmlGZipB64 === 'string') {
			rawXmlGzip = respBody.eventoXmlGZipB64;
		} else if (Array.isArray(respBody.eventos) && respBody.eventos.length > 0) {
			const ev0 = respBody.eventos[0] as Record<string, unknown>;
			if (typeof ev0.arquivoXml === 'string') {
				rawXmlGzip = ev0.arquivoXml;
			}
		}
		if (rawXmlGzip) {
			xmlEvento = EventBuilder.decompressGzipB64ToXml(rawXmlGzip);
		}
	}

	returnData.push({
		pairedItem: { item: i },
		json: {
			sucesso: response.statusCode === 200,
			statusCode: response.statusCode,
			status: response.statusCode === 200 ? 'SUCESSO' : treated.status,
			mensagemRetorno: response.statusCode === 200
				? 'Evento consultado com sucesso na SEFIN Nacional.'
				: treated.mensagemRetorno,
			chaveAcesso,
			tipoEvento,
			numSeqEvento,
			erros: treated.erros,
			alertas: treated.alertas,
			respostaSefin: response.body,
			xmlEvento: xmlEvento || undefined,
			danfseUrl: formatDanfseUrl(chaveAcesso),
		},
	});

	return returnData;
}
