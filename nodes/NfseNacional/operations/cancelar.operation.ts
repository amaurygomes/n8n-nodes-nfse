import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationContext } from './types';
import { XmlSigner } from '../../../core/signature/xmlSigner';
import { EventBuilder } from '../../../core/events/eventBuilder';
import { SefinClient } from '../../../core/client/sefinClient';
import { parseSefinResponseBody } from '../helpers/sefinResponse';

export async function cancelar(this: IExecuteFunctions, i: number, ctx: OperationContext): Promise<INodeExecutionData[]> {
	const { certHolder, prestadorCnpj, ambiente, customUrl } = ctx;
	const returnData: INodeExecutionData[] = [];

	const chaveAcesso = this.getNodeParameter('chaveAcessoCancelamento', i) as string;
	const cMotivo = this.getNodeParameter('codigoMotivo', i, '1') as string;
	const xMotivo = this.getNodeParameter('justificativaCancelamento', i) as string;
	const cancelarOpcoes = (this.getNodeParameter('cancelarOpcoes', i, {}) as Record<string, unknown>) || {};
	const cancelarTimeoutMs = (cancelarOpcoes.timeoutMs as number) || 25000;
	const cancelarRejectUnauth = cancelarOpcoes.rejectUnauthorized !== true;

	if (xMotivo.trim().length < 15) {
		throw new NodeOperationError(
			this.getNode(),
			'A justificativa do cancelamento deve conter no mínimo 15 caracteres conforme regra da Receita Federal.',
			{ itemIndex: i },
		);
	}

	// 1. Constrói o XML oficial do evento 101101 (RTC v1.01)
	const { xml: unsignedEventoXml, pedRegId } = EventBuilder.buildCancelamentoXml({
		ambiente: Number(ambiente),
		chaveAcesso,
		cMotivo,
		xMotivo,
		autorCpfCnpj: prestadorCnpj || certHolder.cnpjCpf,
	});

	// 2. Assina o XML do evento com o Certificado A1
	const signedEventoXml = XmlSigner.signEvento(
		unsignedEventoXml,
		certHolder.privateKeyPem,
		certHolder.certificatePem,
	);

	// 3. Compacta em GZIP Base64
	const gzipB64 = EventBuilder.compressXmlToGzipB64(signedEventoXml);

	// 4. Transmite para o endpoint de eventos da SEFIN Nacional
	const client = new SefinClient({
		ambiente,
		customUrl,
		privateKeyPem: certHolder.privateKeyPem,
		certificatePem: certHolder.certificatePem,
		timeoutMs: cancelarTimeoutMs,
		rejectUnauthorized: cancelarRejectUnauth,
	});

	const response = await client.registrarEvento(chaveAcesso, gzipB64);
	const treated = parseSefinResponseBody(response.body, response.statusCode);

	// Erro E0840: O evento de cancelamento já está vinculado à NFS-e (já foi cancelada com sucesso)
	const jaEstavaCancelada = treated.erros.some((e) => e.codigo === 'E0840') ||
		JSON.stringify(treated.erros).includes('E0840');
	const isCancelado = (response.statusCode >= 200 && response.statusCode < 300 && treated.erros.length === 0) || jaEstavaCancelada;

	let xmlEventoHomologado = '';
	if (typeof response.body === 'object' && response.body !== null) {
		const respBody = response.body as Record<string, unknown>;
		if (typeof respBody.eventoXmlGZipB64 === 'string') {
			xmlEventoHomologado = EventBuilder.decompressGzipB64ToXml(respBody.eventoXmlGZipB64);
		}
	}

	returnData.push({
		pairedItem: { item: i },
		json: {
			sucesso: isCancelado,
			statusCode: jaEstavaCancelada ? 200 : response.statusCode,
			status: isCancelado ? 'CANCELADA' : 'REJEITADA',
			mensagemRetorno: isCancelado
				? (jaEstavaCancelada
					? 'A NFS-e já se encontrava cancelada na SEFIN Nacional (Evento E0840).'
					: 'Cancelamento da NFS-e homologado com sucesso pela SEFIN Nacional.')
				: treated.mensagemRetorno,
			chaveAcesso,
			pedRegId,
			codigoMotivo: cMotivo,
			justificativa: xMotivo,
			jaEstavaCancelada: jaEstavaCancelada ? true : undefined,
			erros: jaEstavaCancelada ? [] : treated.erros,
			alertas: treated.alertas,
			respostaSefin: response.body,
			xmlEventoAssinado: signedEventoXml,
			xmlEventoHomologado: xmlEventoHomologado || undefined,
		},
	});

	return returnData;
}
