import * as https from 'https';

export interface SefinClientConfig {
	ambiente: '1' | '2' | '3';
	customUrl?: string;
	privateKeyPem: string;
	certificatePem: string;
	timeoutMs?: number;
	rejectUnauthorized?: boolean;
}

export interface SefinResponse {
	statusCode: number;
	body: Record<string, unknown> | null;
	rawBody: string;
}

export class SefinClient {
	private config: SefinClientConfig;
	private agent: https.Agent;
	private baseUrl: string;

	constructor(config: SefinClientConfig) {
		this.config = config;

		this.agent = new https.Agent({
			cert: config.certificatePem,
			key: config.privateKeyPem,
			rejectUnauthorized: config.rejectUnauthorized !== false,
			keepAlive: false,
		});

		if (config.ambiente === '1') {
			this.baseUrl = 'https://sefin.nfse.gov.br/sefinnacional/nfse';
		} else if (config.ambiente === '3' && config.customUrl && config.customUrl.trim()) {
			this.baseUrl = config.customUrl.trim().replace(/\/+$/, '');
		} else {
			this.baseUrl = 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse';
		}
	}

	/**
	 * Emite a NFS-e enviando a DPS compactada para o endpoint oficial
	 */
	public async emitirDps(dpsXmlGZipB64: string): Promise<SefinResponse> {
		const payload = JSON.stringify({ dpsXmlGZipB64 });
		return this.request(this.baseUrl, 'POST', payload);
	}

	/**
	 * Consulta uma NFS-e pelo número da Chave de Acesso de 50 dígitos
	 */
	public async consultarNfsePorChave(chaveAcesso: string): Promise<SefinResponse> {
		const cleanKey = chaveAcesso.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		const targetUrl = `${this.baseUrl}/${cleanKey}`;
		return this.request(targetUrl, 'GET');
	}

	/**
	 * Consulta o processamento de um DPS ou NFS-e gerada a partir do Id da DPS (42 dígitos)
	 */
	public async consultarNfsePorDps(idDps: string): Promise<SefinResponse> {
		const cleanId = idDps.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		const targetUrl = `${this.baseUrl}/dps/${cleanId}`;
		return this.request(targetUrl, 'GET');
	}

	/**
	 * Envia um evento fiscal (cancelamento, substituição) para a NFS-e
	 */
	public async registrarEvento(chaveAcesso: string, eventoXmlGZipB64: string): Promise<SefinResponse> {
		const cleanKey = chaveAcesso.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		const targetUrl = `${this.baseUrl}/${cleanKey}/eventos`;
		const payload = JSON.stringify({
			pedidoRegistroEventoXmlGZipB64: eventoXmlGZipB64,
			eventoXmlGZipB64,
		});
		return this.request(targetUrl, 'POST', payload);
	}

	/**
	 * Consulta um evento registrado para a NFS-e (endpoint oficial SEFIN: GET /nfse/{chave}/eventos/{tipoEvento}/{numSeqEvento})
	 */
	public async consultarEventos(
		chaveAcesso: string,
		tipoEvento: string = '101101',
		numSeqEvento: string | number = '1',
	): Promise<SefinResponse> {
		const cleanKey = chaveAcesso.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		const seq = String(numSeqEvento || '1');
		const targetUrl = `${this.baseUrl}/${cleanKey}/eventos/${tipoEvento}/${seq}`;
		return this.request(targetUrl, 'GET');
	}

	private request(urlStr: string, method: string, data?: string): Promise<SefinResponse> {
		return new Promise((resolve, reject) => {
			const url = new URL(urlStr);

			const options: https.RequestOptions = {
				hostname: url.hostname,
				port: url.port || 443,
				path: url.pathname + url.search,
				method: method,
				agent: this.agent,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'User-Agent': 'n8n-nodes-nfse-nacional/0.1.0',
				},
				timeout: this.config.timeoutMs || 25000,
			};

			if (data) {
				options.headers = {
					...options.headers,
					'Content-Length': Buffer.byteLength(data),
				};
			}

			const req = https.request(options, (res) => {
				let rawData = '';
				res.setEncoding('utf-8');

				res.on('data', (chunk) => {
					rawData += chunk;
				});

				res.on('end', () => {
					let parsedBody = null;
					try {
						parsedBody = JSON.parse(rawData);
					} catch {
						parsedBody = rawData;
					}

					resolve({
						statusCode: res.statusCode || 500,
						body: parsedBody,
						rawBody: rawData,
					});
				});
			});

			req.on('error', (err) => {
				reject(new Error(`Erro de conexão mTLS com SEFIN Nacional (${urlStr}): ${err.message}`));
			});

			req.on('timeout', () => {
				req.destroy();
				reject(new Error(`Timeout na requisição mTLS com a SEFIN Nacional (${urlStr})`));
			});

			if (data) {
				req.write(data);
			}

			req.end();
		});
	}
}
