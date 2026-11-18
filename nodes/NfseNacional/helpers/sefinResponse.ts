export interface TreatedSefinMessage {
	codigo: string;
	mensagem: string;
	correcao?: string;
	complemento?: string;
}

export interface TreatedSefinResult {
	sucesso: boolean;
	status: 'AUTORIZADA' | 'REJEITADA' | 'ERRO';
	mensagemRetorno: string;
	chaveAcesso: string;
	numeroNfse: string;
	dataProcessamento: string;
	erros: TreatedSefinMessage[];
	alertas: TreatedSefinMessage[];
}

export function parseSefinResponseBody(body: unknown, statusCode: number): TreatedSefinResult {
	const erros: TreatedSefinMessage[] = [];
	const alertas: TreatedSefinMessage[] = [];
	let chaveAcesso = '';
	let numeroNfse = '';
	let dataProcessamento = '';

	if (body && typeof body === 'object') {
		const b = body as Record<string, unknown>;
		chaveAcesso = String(b.chaveAcesso || b.chNFe || b.chave || '').trim();
		numeroNfse = String(b.nNFSe || b.numeroNfse || b.numero || '').trim();
		dataProcessamento = String(b.dataHoraProcessamento || b.dhRecebimento || b.dhRecbto || '').trim();

		const extractList = (list: unknown, target: TreatedSefinMessage[]) => {
			if (!list) return;
			if (Array.isArray(list)) {
				for (const item of list) {
					if (typeof item === 'object' && item !== null) {
						const it = item as Record<string, unknown>;
						const codigo = String(it.Codigo || it.codigo || it.code || '').trim();
						let mensagem = String(it.Descricao || it.descricao || it.mensagem || it.message || '').trim();
						const correcao = it.Correcao || it.correcao ? String(it.Correcao || it.correcao).trim() : undefined;
						const complemento = it.Complemento || it.complemento ? String(it.Complemento || it.complemento).trim() : undefined;
						if (complemento) {
							mensagem = mensagem ? `${mensagem} (${complemento})` : complemento;
						}
						if (codigo || mensagem) {
							target.push({ codigo, mensagem, correcao, complemento });
						}
					} else if (typeof item === 'string' && item.trim()) {
						target.push({ codigo: '', mensagem: item.trim() });
					}
				}
			} else if (typeof list === 'object') {
				const it = list as Record<string, unknown>;
				const codigo = String(it.Codigo || it.codigo || it.code || '').trim();
				let mensagem = String(it.Descricao || it.descricao || it.mensagem || it.message || '').trim();
				const correcao = it.Correcao || it.correcao ? String(it.Correcao || it.correcao).trim() : undefined;
				const complemento = it.Complemento || it.complemento ? String(it.Complemento || it.complemento).trim() : undefined;
				if (complemento) {
					mensagem = mensagem ? `${mensagem} (${complemento})` : complemento;
				}
				if (codigo || mensagem) {
					target.push({ codigo, mensagem, correcao, complemento });
				}
			}
		};

		extractList(b.erros || b.Erros || b.errors, erros);
		extractList(b.mensagens || b.Mensagens || b.messages, erros);
		extractList(b.alertas || b.Alertas || b.warnings, alertas);

		if (b.error || b.message) {
			const msg = String(b.message || b.error).trim();
			if (msg && !erros.some((e) => e.mensagem === msg)) {
				erros.push({ codigo: String(b.statusCode || statusCode || ''), mensagem: msg });
			}
		}
	} else if (typeof body === 'string' && body.trim()) {
		if (statusCode >= 400) {
			erros.push({ codigo: String(statusCode), mensagem: body.trim() });
		}
	}

	const isHttpSuccess = statusCode >= 200 && statusCode < 300;
	const isAutorizada = isHttpSuccess && Boolean(chaveAcesso) && erros.length === 0;
	const status: 'AUTORIZADA' | 'REJEITADA' | 'ERRO' = isAutorizada
		? 'AUTORIZADA'
		: isHttpSuccess && !chaveAcesso
			? 'REJEITADA'
			: statusCode >= 400 && statusCode < 500
				? 'REJEITADA'
				: 'ERRO';

	let mensagemRetorno = '';
	if (isAutorizada) {
		mensagemRetorno = alertas.length > 0
			? `NFS-e autorizada com sucesso com ${alertas.length} aviso(s).`
			: 'NFS-e autorizada com sucesso pela SEFIN Nacional.';
	} else if (erros.length > 0) {
		const firstErr = erros[0];
		mensagemRetorno = firstErr.codigo
			? `Rejeição [${firstErr.codigo}]: ${firstErr.mensagem}`
			: `Rejeição: ${firstErr.mensagem}`;
		if (erros.length > 1) {
			mensagemRetorno += ` (e mais ${erros.length - 1} erro(s))`;
		}
	} else if (statusCode === 405) {
		mensagemRetorno = 'Método HTTP não suportado pelo endpoint da SEFIN.';
	} else {
		mensagemRetorno = `Falha na comunicação com a SEFIN Nacional (HTTP ${statusCode}).`;
	}

	return {
		sucesso: isAutorizada,
		status,
		mensagemRetorno,
		chaveAcesso,
		numeroNfse,
		dataProcessamento,
		erros,
		alertas,
	};
}

export function extractTag(xml: string, tag: string): string {
	if (!xml) return '';
	const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
	return m ? m[1].trim() : '';
}
