import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { loadLogoBuffer } from './logo';

export interface DanfseData {
	numeroNfse: string;
	serie?: string;
	dpsNumero?: string;
	dataEmissaoDps?: string;
	chaveAcesso: string;
	dataEmissao: string;
	competencia?: string;
	ambiente: string; // Produção ('1') ou Homologação ('2')
	status?: 'AUTORIZADA' | 'CANCELADA' | string;
	finalidade?: string;
	prestador: {
		razaoSocial: string;
		cnpj: string;
		inscricaoMunicipal?: string;
		municipio: string;
		uf: string;
		codigoIbge?: string;
		logradouro?: string;
		numero?: string;
		complemento?: string;
		bairro?: string;
		cep?: string;
		telefone?: string;
		email?: string;
		opSimpNac?: number; // 1 = Não Optante, 2 = MEI, 3 = ME/EPP
		regApTribSN?: number | string;
	};
	tomador: {
		nome?: string;
		cpfCnpj?: string;
		inscricaoMunicipal?: string;
		email?: string;
		telefone?: string;
		logradouro?: string;
		numero?: string;
		complemento?: string;
		bairro?: string;
		cep?: string;
		municipio?: string;
		uf?: string;
		codigoIbge?: string;
		naoIdentificado?: boolean;
	};
	destinatario?: {
		nome?: string;
		cpfCnpj?: string;
		telefone?: string;
		email?: string;
		logradouro?: string;
		numero?: string;
		complemento?: string;
		bairro?: string;
		cep?: string;
		municipio?: string;
		uf?: string;
		codigoIbge?: string;
		isTomador?: boolean;
	};
	intermediario?: {
		nome?: string;
		cpfCnpj?: string;
		inscricaoMunicipal?: string;
		telefone?: string;
		email?: string;
		logradouro?: string;
		numero?: string;
		complemento?: string;
		bairro?: string;
		cep?: string;
		municipio?: string;
		uf?: string;
		codigoIbge?: string;
	};
	servico: {
		descricao: string;
		codigoTributacao: string;
		discriminacaoTributacao?: string;
		codigoNbs?: string;
		cnae?: string;
		municipioPrestacao?: string;
		ufPrestacao?: string;
		paisPrestacao?: string;
		valorServicos: number;
		valorLiquido?: number;
		valorDesconto?: number;
		descontoCondicionado?: number;
		valorDeducoes?: number;
		aliquotaIss?: number;
		valorIss?: number;
		tipoTributacaoIss?: string;
		regimeEspecialIss?: string;
		tipoImunidadeIss?: string;
		suspensaoIss?: string;
		numProcessoSuspensao?: string;
		beneficioMunicipal?: string;
		calculoBm?: number;
		retencaoIss?: string;
	};
	tributosFederais?: {
		pis?: number;
		cofins?: number;
		inss?: number;
		irrf?: number;
		csll?: number;
		totalRetencoes?: number;
		descContribSociais?: string;
	};
	ibscbs?: {
		cst?: string;
		cClassTrib?: string;
		indOperacao?: string;
		municipioIncidencia?: string;
		ufIncidencia?: string;
		ibgeIncidencia?: string;
		exclusoesReducoes?: number;
		baseCalculo?: number;
		redAliqIbs?: number;
		redAliqCbs?: number;
		aliquotaIbsUf?: number;
		aliquotaIbsMun?: number;
		aliqEfetivaIbsMun?: number;
		valorIbsMun?: number;
		aliqEfetivaIbsUf?: number;
		valorIbsUf?: number;
		valorTotalIbs?: number;
		valorIbs?: number;
		aliquotaCbs?: number;
		aliqEfetivaCbs?: number;
		valorTotalCbs?: number;
		valorCbs?: number;
	};
	informacoesComplementares?: string;
}

export function unescapeXml(str?: string): string {
	if (!str) return '';
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

export function formatDateBr(dateStr?: string): string {
	if (!dateStr || !dateStr.trim()) return '';
	const clean = dateStr.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
		const [y, m, d] = clean.split('-');
		return `${d}/${m}/${y}`;
	}
	if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) {
		const [y, m, d] = clean.split('/');
		return `${d}/${m}/${y}`;
	}
	return clean;
}

export function cleanRazaoSocial(razao?: string): string {
	if (!razao) return 'Razão Social Não Informada';
	const unescaped = unescapeXml(razao);
	const cnMatch = unescaped.match(/CN=([^:,]+)/i);
	if (cnMatch && cnMatch[1]) {
		return cnMatch[1].trim();
	}
	if (unescaped.includes('C=BR') || unescaped.includes('O=ICP-Brasil')) {
		const parts = unescaped.split(',');
		for (const part of parts) {
			const p = part.trim();
			if (p.startsWith('CN=')) {
				return p.replace(/^CN=/, '').split(':')[0].trim();
			}
		}
	}
	return unescaped;
}

export function formatCpfCnpj(val?: string): string {
	if (!val) return '-';
	if (val.includes('*')) return val;
	const d = val.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
	if (d.length === 11 && /^\d+$/.test(d)) {
		return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
	}
	if (d.length === 14) {
		return d.replace(/^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})([0-9A-Z]{2})$/, '$1.$2.$3/$4-$5');
	}
	return val;
}

export function maskDanfseData(data: DanfseData): DanfseData {
	const clone: DanfseData = JSON.parse(JSON.stringify(data));

	const maskCpfCnpj = (doc?: string): string => {
		if (!doc) return '';
		const clean = doc.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		if (clean.length === 11 && /^\d+$/.test(clean)) {
			return `${clean.slice(0, 3)}.***.***-${clean.slice(-2)}`;
		}
		if (clean.length === 14) {
			return `${clean.slice(0, 2)}.***.***/${clean.slice(8, 12)}-**`;
		}
		return '***.***.***-**';
	};

	const maskName = (name?: string): string => {
		if (!name) return '';
		const parts = name.trim().split(/\s+/);
		if (parts.length === 1) {
			return parts[0].length > 3 ? `${parts[0].slice(0, 2)}***` : '***';
		}
		return parts
			.map((p, idx) => {
				const up = p.toUpperCase();
				if (['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(up)) return p;
				if (idx === parts.length - 1 && ['LTDA', 'ME', 'EPP', 'S/A', 'SA', 'EIRELI', 'SS'].includes(up)) return p;
				if (p.length <= 2) return p;
				return p[0] + '*'.repeat(Math.min(p.length - 1, 4));
			})
			.join(' ');
	};

	const maskEmail = (email?: string): string => {
		if (!email || !email.includes('@')) return '';
		const [user, domain] = email.split('@');
		const maskedUser = user.length > 2 ? `${user.slice(0, 2)}****` : '****';
		const domainParts = domain.split('.');
		const ext = domainParts.length > 1 ? domainParts.slice(1).join('.') : 'com';
		return `${maskedUser}@*****.${ext}`;
	};

	const maskPhone = (phone?: string): string => {
		if (!phone) return '';
		const clean = phone.replace(/\D/g, '');
		if (clean.length >= 10) {
			const ddd = clean.slice(0, 2);
			const end = clean.slice(-2);
			return `(${ddd}) 9****-**${end}`;
		}
		return '(**) *****-****';
	};

	const maskAddress = (street?: string): string => {
		if (!street) return '';
		const parts = street.trim().split(/\s+/);
		if (parts.length <= 1) return 'Rua **********';
		return `${parts[0]} ******************`;
	};

	const maskChave = (chave?: string): string => {
		if (!chave) return '';
		const clean = chave.replace(/\D/g, '');
		if (clean.length >= 50) {
			const prefix = clean.slice(0, 6);
			const suffix = clean.slice(-4);
			const mid = '****************************************';
			const full = prefix + mid + suffix;
			return full.replace(/(\S{4})/g, '$1 ').trim();
		}
		return '3526 09** **** **** **** **** **** **** **** **** 0000';
	};

	if (clone.prestador) {
		clone.prestador.cnpj = maskCpfCnpj(clone.prestador.cnpj);
		clone.prestador.razaoSocial = maskName(cleanRazaoSocial(clone.prestador.razaoSocial));
		if (clone.prestador.inscricaoMunicipal) clone.prestador.inscricaoMunicipal = '******';
		if (clone.prestador.telefone) clone.prestador.telefone = maskPhone(clone.prestador.telefone);
		if (clone.prestador.email) clone.prestador.email = maskEmail(clone.prestador.email);
		if (clone.prestador.logradouro) clone.prestador.logradouro = maskAddress(clone.prestador.logradouro);
		if (clone.prestador.numero) clone.prestador.numero = '***';
		if (clone.prestador.complemento) clone.prestador.complemento = '***';
		if (clone.prestador.bairro) clone.prestador.bairro = '*****';
		if (clone.prestador.cep) clone.prestador.cep = '*****-***';
	}

	if (clone.tomador) {
		if (clone.tomador.nome) clone.tomador.nome = maskName(clone.tomador.nome);
		if (clone.tomador.cpfCnpj) clone.tomador.cpfCnpj = maskCpfCnpj(clone.tomador.cpfCnpj);
		if (clone.tomador.inscricaoMunicipal) clone.tomador.inscricaoMunicipal = '******';
		if (clone.tomador.email) clone.tomador.email = maskEmail(clone.tomador.email);
		if (clone.tomador.telefone) clone.tomador.telefone = maskPhone(clone.tomador.telefone);
		if (clone.tomador.logradouro) clone.tomador.logradouro = maskAddress(clone.tomador.logradouro);
		if (clone.tomador.numero) clone.tomador.numero = '***';
		if (clone.tomador.complemento) clone.tomador.complemento = '***';
		if (clone.tomador.bairro) clone.tomador.bairro = '*****';
		if (clone.tomador.cep) clone.tomador.cep = '*****-***';
	}

	if (clone.intermediario) {
		if (clone.intermediario.nome) clone.intermediario.nome = maskName(clone.intermediario.nome);
		if (clone.intermediario.cpfCnpj) clone.intermediario.cpfCnpj = maskCpfCnpj(clone.intermediario.cpfCnpj);
		if (clone.intermediario.inscricaoMunicipal) clone.intermediario.inscricaoMunicipal = '******';
		if (clone.intermediario.email) clone.intermediario.email = maskEmail(clone.intermediario.email);
		if (clone.intermediario.telefone) clone.intermediario.telefone = maskPhone(clone.intermediario.telefone);
	}

	if (clone.destinatario) {
		if (clone.destinatario.nome) clone.destinatario.nome = maskName(clone.destinatario.nome);
		if (clone.destinatario.cpfCnpj) clone.destinatario.cpfCnpj = maskCpfCnpj(clone.destinatario.cpfCnpj);
		if (clone.destinatario.telefone) clone.destinatario.telefone = maskPhone(clone.destinatario.telefone);
		if (clone.destinatario.email) clone.destinatario.email = maskEmail(clone.destinatario.email);
	}

	if (clone.chaveAcesso) {
		clone.chaveAcesso = maskChave(clone.chaveAcesso);
	}

	if (clone.informacoesComplementares) {
		clone.informacoesComplementares = clone.informacoesComplementares
			.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***.***.***-**')
			.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '**.***.***/****-**')
			.replace(/([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, '****@*****.com');
	}

	return clone;
}

export function formatMoeda(val?: number): string {
	if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
	return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface CellOptions {
	label?: string;
	value?: string;
	isBlockTitle?: boolean;
	isShaded?: boolean;
	labelFontSize?: number;
	valueFontSize?: number;
	align?: 'left' | 'center' | 'right';
	isRed?: boolean;
	isBoldValue?: boolean;
}

export class DanfseGenerator {
	private static drawCell(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		w: number,
		h: number,
		options: CellOptions = {},
	) {
		const isShaded = options.isShaded || options.isBlockTitle;
		const fillColor = isShaded ? '#f2f2f2' : '#ffffff';

		doc.save();
		doc.rect(x, y, w, h).lineWidth(0.5).fillAndStroke(fillColor, '#000000');

		if (options.isBlockTitle) {
			const text = options.label || options.value || '';
			const fontSize = options.labelFontSize || 7;
			doc.fillColor('#000000')
				.font('Helvetica-Bold')
				.fontSize(fontSize)
				.text(text, x + 2, y + (h / 2) - (fontSize / 2) - 0.5, {
					width: w - 4,
					align: options.align || 'center',
					ellipsis: true,
				});
			doc.restore();
			return;
		}

		let currentY = y + 2;
		if (options.label) {
			const labelSize = options.labelFontSize || 6;
			doc.fillColor('#000000')
				.font('Helvetica-Bold')
				.fontSize(labelSize)
				.text(options.label, x + 2.5, currentY, {
					width: w - 5,
					align: 'left',
					ellipsis: true,
				});
			currentY += labelSize + 1.5;
		}

		if (options.value !== undefined) {
			const valSize = options.valueFontSize || 7;
			const textColor = options.isRed ? '#ff0000' : '#000000';
			const fontName = options.isBoldValue ? 'Helvetica-Bold' : 'Helvetica';
			doc.fillColor(textColor)
				.font(fontName)
				.fontSize(valSize)
				.text(options.value || '-', x + 2.5, currentY, {
					width: w - 5,
					align: options.align || 'left',
					ellipsis: true,
				});
		}

		doc.restore();
	}

	public static async generatePdf(data: DanfseData): Promise<Buffer> {
		const doc = new PDFDocument({
			size: 'A4',
			margin: 14.17, // ~0.5 cm
			info: {
				Title: `DANFSe v2.0 - NFS-e Nº ${data.numeroNfse}`,
				Author: 'SEFIN Nacional - Receita Federal do Brasil',
				Subject: 'Documento Auxiliar da NFS-e - Padrão Nacional NT-008/2026',
				Creator: 'n8n-nodes-nfse-nacional',
			},
		});

		const chunks: Buffer[] = [];
		doc.on('data', (chunk: Buffer) => chunks.push(chunk));

		const isHomologacao = data.ambiente === '2' || data.ambiente.toLowerCase().includes('homolog');
		const isCancelada = (data.status || '').toUpperCase() === 'CANCELADA';
		const isSubstituida = (data.status || '').toUpperCase() === 'SUBSTITUIDA' || (data.status || '').toUpperCase() === 'SUBSTITUÍDA';

		const isMaskedKey = Boolean(data.chaveAcesso && data.chaveAcesso.includes('*'));
		const cleanKey = isMaskedKey ? data.chaveAcesso : (data.chaveAcesso ? data.chaveAcesso.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : '');
		const formattedKey = isMaskedKey ? data.chaveAcesso : cleanKey.replace(/(\d{4})/g, '$1 ').trim();
		// URL oficial especificada na NT-008 página 15:
		const qrCodeUrl = isMaskedKey
			? 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=00000000000000000000000000000000000000000000000000'
			: `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${cleanKey}`;
		const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, { width: 140, margin: 0 });
		const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

		const prestadorNome = cleanRazaoSocial(data.prestador.razaoSocial);
		const prestadorMun = data.prestador.municipio && data.prestador.municipio !== 'Município Emissor'
			? unescapeXml(data.prestador.municipio)
			: 'Dourados';
		const prestadorUf = data.prestador.uf && data.prestador.uf !== 'UF'
			? unescapeXml(data.prestador.uf)
			: 'MS';

		const leftX = 14.17;
		const pageWidth = 567.0;
		const colW = pageWidth / 4; // 141.75 pt cada coluna
		let y = 14.17;

		// ─── 1. CABEÇALHO OFICIAL (NT-008 Seção 2.4.3 e Página 15) ─────────────
		const headerH = 44;
		// Coluna 1: Logo Oficial NFS-e (110 pt)
		this.drawCell(doc, leftX, y, 110, headerH, { isShaded: true });
		const logoBuf = loadLogoBuffer();
		if (logoBuf) {
			try {
				doc.image(logoBuf, leftX + 5, y + 5, { fit: [100, 34], align: 'center', valign: 'center' });
			} catch {
				doc.fillColor('#059669').fontSize(13).font('Helvetica-Bold')
					.text('NFS-e', leftX + 5, y + 16, { width: 100, align: 'center' });
			}
		} else {
			doc.fillColor('#059669').fontSize(13).font('Helvetica-Bold')
				.text('NFS-e', leftX + 5, y + 16, { width: 100, align: 'center' });
		}

		// Coluna 2: Título Central (295 pt)
		const centerW = 295;
		const centerX = leftX + 110;
		this.drawCell(doc, centerX, y, centerW, headerH, { isShaded: true });
		const titleY = isHomologacao ? y + 4.5 : y + 10;
		doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9)
			.text('DANFSe v2.0', centerX, titleY, { width: centerW, align: 'center' });
		doc.text('Documento Auxiliar da NFS-e', centerX, titleY + 11.5, { width: centerW, align: 'center' });
		if (isHomologacao) {
			doc.fillColor('#FF0000').font('Helvetica-Bold').fontSize(9)
				.text('NFS-e SEM VALIDADE JURÍDICA', centerX, titleY + 23, { width: centerW, align: 'center' });
		}

		// Coluna 3: Município e Ambiente (162 pt)
		const rightW = pageWidth - 110 - centerW;
		const rightX = centerX + centerW;
		this.drawCell(doc, rightX, y, rightW, headerH, { isShaded: true });
		doc.fillColor('#000000').font('Helvetica').fontSize(7.5)
			.text(`Município: ${prestadorMun} - ${prestadorUf}`, rightX + 4, y + 6, { width: rightW - 8, ellipsis: true });
		doc.fontSize(6)
			.text('Ambiente Gerador: Nacional', rightX + 4, y + 19, { width: rightW - 8 })
			.text(`Tipo de Ambiente: ${isHomologacao ? '2 - Homologação' : '1 - Produção'}`, rightX + 4, y + 29, { width: rightW - 8 });

		y += headerH;

		// ─── 2. DADOS DA NFS-E & QR CODE (NT-008 Item 2.1.2 e Anexo I) ─────────
		const idH = 72;
		const leftIdW = colW * 3; // 425.25 pt
		const rightIdW = colW;    // 141.75 pt
		const idColW = leftIdW / 3; // 141.75 pt

		// Linha 1: CHAVE DE ACESSO DA NFS-E
		this.drawCell(doc, leftX, y, leftIdW, 18, {
			label: 'CHAVE DE ACESSO DA NFS-E',
			labelFontSize: 7,
			value: formattedKey || cleanKey || '-',
			valueFontSize: 7,
			isBoldValue: true,
		});

		// Linha 2: NÚMERO DA NFS-E | COMPETÊNCIA DA NFS-E | DATA E HORA DA EMISSÃO DA NFS-E
		const emissaoStr = data.dataEmissao || formatDateBr(new Date().toISOString().split('T')[0]);
		const compStr = formatDateBr(data.competencia) || emissaoStr.split(' ')[0];
		this.drawCell(doc, leftX, y + 18, idColW, 18, {
			label: 'NÚMERO DA NFS-E',
			labelFontSize: 7,
			value: data.numeroNfse || '-',
			valueFontSize: 7,
			isBoldValue: true,
		});
		this.drawCell(doc, leftX + idColW, y + 18, idColW, 18, {
			label: 'COMPETÊNCIA DA NFS-E',
			labelFontSize: 7,
			value: compStr,
			valueFontSize: 7,
		});
		this.drawCell(doc, leftX + idColW * 2, y + 18, idColW, 18, {
			label: 'DATA E HORA DA EMISSÃO DA NFS-E',
			labelFontSize: 7,
			value: emissaoStr,
			valueFontSize: 7,
		});

		// Linha 3: NÚMERO DA DPS | SÉRIE DA DPS | DATA E HORA DA EMISSÃO DA DPS
		this.drawCell(doc, leftX, y + 36, idColW, 18, {
			label: 'NÚMERO DA DPS',
			labelFontSize: 7,
			value: data.dpsNumero || data.numeroNfse || '-',
			valueFontSize: 7,
		});
		this.drawCell(doc, leftX + idColW, y + 36, idColW, 18, {
			label: 'SÉRIE DA DPS',
			labelFontSize: 7,
			value: data.serie || '1',
			valueFontSize: 7,
		});
		this.drawCell(doc, leftX + idColW * 2, y + 36, idColW, 18, {
			label: 'DATA E HORA DA EMISSÃO DA DPS',
			labelFontSize: 7,
			value: data.dataEmissaoDps || emissaoStr,
			valueFontSize: 7,
		});

		// Linha 4: EMITENTE DA NFS-e (fundo cinza 5%) | SITUAÇÃO DA NFS-e | FINALIDADE
		this.drawCell(doc, leftX, y + 54, idColW, 18, {
			label: 'EMITENTE DA NFS-e',
			labelFontSize: 7,
			isShaded: true,
			value: 'Prestador',
			valueFontSize: 7,
		});
		const sitNfse = isCancelada ? 'CANCELADA' : 'AUTORIZADA';
		this.drawCell(doc, leftX + idColW, y + 54, idColW, 18, {
			label: 'SITUAÇÃO DA NFS-e',
			labelFontSize: 7,
			value: sitNfse,
			valueFontSize: 7,
			isBoldValue: true,
			isRed: isCancelada,
		});
		this.drawCell(doc, leftX + idColW * 2, y + 54, idColW, 18, {
			label: 'FINALIDADE',
			labelFontSize: 7,
			value: data.finalidade || 'NFS-e regular',
			valueFontSize: 7,
		});

		// Coluna da Direita: QR Code & Texto Legal de Autenticidade (NT-008 pág 15)
		const qrX = leftX + leftIdW;
		this.drawCell(doc, qrX, y, rightIdW, idH, { isShaded: false });
		const qrSize = 43;
		const qrLeft = qrX + (rightIdW - qrSize) / 2;
		doc.image(qrCodeBuffer, qrLeft, y + 3, { width: qrSize, height: qrSize });
		doc.fillColor('#000000').font('Helvetica').fontSize(5.5)
			.text(
				'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e',
				qrX + 3,
				y + 48,
				{ width: rightIdW - 6, align: 'center', lineGap: 0.8 },
			);

		y += idH;

		// ─── 3. PRESTADOR / FORNECEDOR (4 Linhas x 17 pt = 68 pt) ─────────────
		const prestH = 17;
		this.drawCell(doc, leftX, y, colW, prestH, { label: 'PRESTADOR / FORNECEDOR', isBlockTitle: true });
		this.drawCell(doc, leftX + colW, y, colW, prestH, {
			label: 'CNPJ / CPF / NIF',
			value: formatCpfCnpj(data.prestador.cnpj),
		});
		this.drawCell(doc, leftX + colW * 2, y, colW, prestH, {
			label: 'Indicador Municipal (Inscrição)',
			value: unescapeXml(data.prestador.inscricaoMunicipal) || '-',
		});
		this.drawCell(doc, leftX + colW * 3, y, colW, prestH, {
			label: 'Telefone',
			value: data.prestador.telefone || '-',
		});
		y += prestH;

		this.drawCell(doc, leftX, y, colW * 2, prestH, {
			label: 'Nome / Nome Empresarial',
			value: prestadorNome,
			isBoldValue: true,
		});
		this.drawCell(doc, leftX + colW * 2, y, colW, prestH, {
			label: 'Município / Sigla UF',
			value: `${prestadorMun} / ${prestadorUf}`,
		});
		const ibgePrest = data.prestador.codigoIbge || '-';
		const cepPrest = data.prestador.cep ? data.prestador.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '-';
		this.drawCell(doc, leftX + colW * 3, y, colW, prestH, {
			label: 'Código IBGE / CEP',
			value: `${ibgePrest} / ${cepPrest}`,
		});
		y += prestH;

		const partesEndPrest: string[] = [];
		if (data.prestador.logradouro) partesEndPrest.push(unescapeXml(data.prestador.logradouro));
		if (data.prestador.numero) partesEndPrest.push(unescapeXml(data.prestador.numero));
		if (data.prestador.complemento) partesEndPrest.push(unescapeXml(data.prestador.complemento));
		if (data.prestador.bairro) partesEndPrest.push(unescapeXml(data.prestador.bairro));
		const endPrestadorStr = partesEndPrest.join(', ') || '-';
		this.drawCell(doc, leftX, y, colW * 2, prestH, {
			label: 'Endereço',
			value: endPrestadorStr,
		});
		this.drawCell(doc, leftX + colW * 2, y, colW * 2, prestH, {
			label: 'E-mail',
			value: unescapeXml(data.prestador.email) || '-',
		});
		y += prestH;

		const opSN = data.prestador.opSimpNac ?? 3;
		let snText = 'Não Optante';
		let regApText = '-';
		if (opSN === 2) {
			snText = 'Optante - MEI';
			regApText = 'Regime único de arrecadação dos tributos (SIMEI)';
		} else if (opSN === 3) {
			snText = 'Optante - ME/EPP';
			regApText = 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional';
		}
		this.drawCell(doc, leftX, y, colW * 2, prestH, {
			label: 'Simples Nacional na Data de Competência',
			value: snText,
		});
		this.drawCell(doc, leftX + colW * 2, y, colW * 2, prestH, {
			label: 'Regime de Apuração Tributária pelo SN',
			value: regApText,
		});
		y += prestH;

		// ─── 4. TOMADOR / ADQUIRENTE (3 Linhas x 17 pt = 51 pt) ───────────────
		const tomaH = 17;
		const rawTomadorNome = unescapeXml(data.tomador.nome);
		const hasTomador = Boolean(data.tomador.cpfCnpj || (rawTomadorNome && rawTomadorNome !== 'Consumidor Final'));
		if (!hasTomador && data.tomador.naoIdentificado) {
			this.drawCell(doc, leftX, y, colW, 18, { label: 'TOMADOR / ADQUIRENTE', isBlockTitle: true });
			this.drawCell(doc, leftX + colW, y, colW * 3, 18, {
				value: 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e',
				valueFontSize: 7,
			});
			y += 18;
		} else {
			this.drawCell(doc, leftX, y, colW, tomaH, { label: 'TOMADOR / ADQUIRENTE', isBlockTitle: true });
			this.drawCell(doc, leftX + colW, y, colW, tomaH, {
				label: 'CNPJ / CPF / NIF',
				value: formatCpfCnpj(data.tomador.cpfCnpj),
			});
			this.drawCell(doc, leftX + colW * 2, y, colW, tomaH, {
				label: 'Indicador Municipal (Inscrição)',
				value: unescapeXml(data.tomador.inscricaoMunicipal) || '-',
			});
			this.drawCell(doc, leftX + colW * 3, y, colW, tomaH, {
				label: 'Telefone',
				value: data.tomador.telefone || '-',
			});
			y += tomaH;

			this.drawCell(doc, leftX, y, colW * 2, tomaH, {
				label: 'Nome / Nome Empresarial',
				value: rawTomadorNome || 'Consumidor Final',
				isBoldValue: true,
			});
			const munToma = unescapeXml(data.tomador.municipio) || '-';
			const ufToma = unescapeXml(data.tomador.uf) || '-';
			this.drawCell(doc, leftX + colW * 2, y, colW, tomaH, {
				label: 'Município / Sigla UF',
				value: munToma !== '-' ? `${munToma} / ${ufToma}` : '-',
			});
			const ibgeToma = data.tomador.codigoIbge || '-';
			const cepToma = data.tomador.cep ? data.tomador.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '-';
			this.drawCell(doc, leftX + colW * 3, y, colW, tomaH, {
				label: 'Código IBGE / CEP',
				value: ibgeToma !== '-' || cepToma !== '-' ? `${ibgeToma} / ${cepToma}` : '-',
			});
			y += tomaH;

			const partesEndToma: string[] = [];
			if (data.tomador.logradouro) partesEndToma.push(unescapeXml(data.tomador.logradouro));
			if (data.tomador.numero) partesEndToma.push(unescapeXml(data.tomador.numero));
			if (data.tomador.complemento) partesEndToma.push(unescapeXml(data.tomador.complemento));
			if (data.tomador.bairro) partesEndToma.push(unescapeXml(data.tomador.bairro));
			const endTomaStr = partesEndToma.join(', ') || '-';
			this.drawCell(doc, leftX, y, colW * 2, tomaH, {
				label: 'Endereço',
				value: endTomaStr,
			});
			this.drawCell(doc, leftX + colW * 2, y, colW * 2, tomaH, {
				label: 'E-mail',
				value: unescapeXml(data.tomador.email) || '-',
			});
			y += tomaH;
		}

		// ─── 5. DESTINATÁRIO DA OPERAÇÃO (Nota 3: Se próprio tomador -> 18 pt) ──
		const hasCustomDest = Boolean(data.destinatario && !data.destinatario.isTomador && (data.destinatario.nome || data.destinatario.cpfCnpj));
		if (!hasCustomDest) {
			this.drawCell(doc, leftX, y, colW, 18, { label: 'DESTINATÁRIO DA OPERAÇÃO', isBlockTitle: true, labelFontSize: 6 });
			this.drawCell(doc, leftX + colW, y, colW * 3, 18, {
				value: 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO',
				valueFontSize: 7,
			});
			y += 18;
		} else {
			this.drawCell(doc, leftX, y, colW, 17, { label: 'DESTINATÁRIO DA OPERAÇÃO', isBlockTitle: true, labelFontSize: 6 });
			this.drawCell(doc, leftX + colW, y, colW, 17, {
				label: 'CNPJ / CPF / NIF',
				value: formatCpfCnpj(data.destinatario?.cpfCnpj),
			});
			this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Indicador Municipal (Inscrição)', value: '-' });
			this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Telefone', value: data.destinatario?.telefone || '-' });
			y += 17;

			this.drawCell(doc, leftX, y, colW * 2, 17, {
				label: 'Nome / Nome Empresarial',
				value: unescapeXml(data.destinatario?.nome) || '-',
				isBoldValue: true,
			});
			this.drawCell(doc, leftX + colW * 2, y, colW, 17, {
				label: 'Município / Sigla UF',
				value: `${unescapeXml(data.destinatario?.municipio) || '-'} / ${unescapeXml(data.destinatario?.uf) || '-'}`,
			});
			this.drawCell(doc, leftX + colW * 3, y, colW, 17, {
				label: 'Código IBGE / CEP',
				value: `${data.destinatario?.codigoIbge || '-'} / ${data.destinatario?.cep || '-'}`,
			});
			y += 17;

			this.drawCell(doc, leftX, y, colW * 2, 17, { label: 'Endereço', value: unescapeXml(data.destinatario?.logradouro) || '-' });
			this.drawCell(doc, leftX + colW * 2, y, colW * 2, 17, { label: 'E-mail', value: unescapeXml(data.destinatario?.email) || '-' });
			y += 17;
		}

		// ─── 6. INTERMEDIÁRIO DA OPERAÇÃO (Nota 2: Se não identificado -> 18 pt) 
		const hasInterm = Boolean(data.intermediario && (data.intermediario.nome || data.intermediario.cpfCnpj));
		if (!hasInterm) {
			this.drawCell(doc, leftX, y, colW, 18, { label: 'INTERMEDIÁRIO DA OPERAÇÃO', isBlockTitle: true, labelFontSize: 6 });
			this.drawCell(doc, leftX + colW, y, colW * 3, 18, {
				value: 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e',
				valueFontSize: 7,
			});
			y += 18;
		} else {
			this.drawCell(doc, leftX, y, colW, 17, { label: 'INTERMEDIÁRIO DA OPERAÇÃO', isBlockTitle: true, labelFontSize: 6 });
			this.drawCell(doc, leftX + colW, y, colW, 17, {
				label: 'CNPJ / CPF / NIF',
				value: formatCpfCnpj(data.intermediario?.cpfCnpj),
			});
			this.drawCell(doc, leftX + colW * 2, y, colW, 17, {
				label: 'Indicador Municipal (Inscrição)',
				value: unescapeXml(data.intermediario?.inscricaoMunicipal) || '-',
			});
			this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Telefone', value: data.intermediario?.telefone || '-' });
			y += 17;

			this.drawCell(doc, leftX, y, colW * 2, 17, {
				label: 'Nome / Nome Empresarial',
				value: unescapeXml(data.intermediario?.nome) || '-',
				isBoldValue: true,
			});
			this.drawCell(doc, leftX + colW * 2, y, colW, 17, {
				label: 'Município / Sigla UF',
				value: `${unescapeXml(data.intermediario?.municipio) || '-'} / ${unescapeXml(data.intermediario?.uf) || '-'}`,
			});
			this.drawCell(doc, leftX + colW * 3, y, colW, 17, {
				label: 'Código IBGE / CEP',
				value: `${data.intermediario?.codigoIbge || '-'} / ${data.intermediario?.cep || '-'}`,
			});
			y += 17;

			this.drawCell(doc, leftX, y, colW * 2, 17, { label: 'Endereço', value: unescapeXml(data.intermediario?.logradouro) || '-' });
			this.drawCell(doc, leftX + colW * 2, y, colW * 2, 17, { label: 'E-mail', value: unescapeXml(data.intermediario?.email) || '-' });
			y += 17;
		}

		// ─── 7. SERVIÇO PRESTADO (Linha 1: 17 pt, Linha 2: 15 pt, Linha 3: 36 pt) ─
		this.drawCell(doc, leftX, y, colW, 17, { label: 'SERVIÇO PRESTADO', isBlockTitle: true });
		const cTribFormatted = data.servico.codigoTributacao
			? data.servico.codigoTributacao.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')
			: '01.03.01';
		this.drawCell(doc, leftX + colW, y, colW, 17, {
			label: 'Código de Tributação Nacional / Municipal',
			value: `${cTribFormatted} / -`,
		});
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, {
			label: 'Código da NBS',
			value: data.servico.codigoNbs || '-',
		});
		const locPrest = data.servico.municipioPrestacao || `${prestadorMun} / ${prestadorUf}`;
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, {
			label: 'Local da Prestação / Sigla UF / País',
			value: `${locPrest} / BR`,
		});
		y += 17;

		const descTribNac = data.servico.discriminacaoTributacao || '-';
		this.drawCell(doc, leftX, y, pageWidth, 15, {
			label: 'Descrição do Código de Tributação Nacional / Municipal:',
			value: descTribNac,
			valueFontSize: 6.5,
		});
		y += 15;

		const descServicoCompleta = unescapeXml(data.servico.descricao) || '-';
		this.drawCell(doc, leftX, y, pageWidth, 36, {
			label: 'Descrição do Serviço',
			value: descServicoCompleta,
			valueFontSize: 6.5,
		});
		y += 36;

		// ─── 8. TRIBUTAÇÃO MUNICIPAL (ISSQN) (4 Linhas x 17 pt = 68 pt) ─────────
		this.drawCell(doc, leftX, y, colW, 17, { label: 'TRIBUTAÇÃO MUNICIPAL (ISSQN)', isBlockTitle: true, labelFontSize: 5.5 });
		this.drawCell(doc, leftX + colW, y, colW, 17, {
			label: 'Tipo de Tributação do ISSQN',
			value: data.servico.tipoTributacaoIss || 'Operação Tributável',
		});
		this.drawCell(doc, leftX + colW * 2, y, colW * 2, 17, {
			label: 'Município / Sigla UF / País da Incidência do ISSQN',
			value: `${prestadorMun} / ${prestadorUf} / BR`,
		});
		y += 17;

		this.drawCell(doc, leftX, y, colW, 17, { label: 'Regime Especial de Tributação do ISSQN', value: data.servico.regimeEspecialIss || '-' });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'Tipo de Imunidade do ISSQN', value: data.servico.tipoImunidadeIss || '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Suspensão da Exigibilidade do ISSQN', value: data.servico.suspensaoIss || '-' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Número Processo Suspensão', value: data.servico.numProcessoSuspensao || '-' });
		y += 17;

		const vDescInc = Number(data.servico.valorDesconto || 0);
		const vDedTot = Number(data.servico.valorDeducoes || 0);
		this.drawCell(doc, leftX, y, colW, 17, { label: 'Benefício Municipal', value: data.servico.beneficioMunicipal || '-' });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'Cálculo do BM', value: data.servico.calculoBm ? formatMoeda(data.servico.calculoBm) : '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Total Deduções/Reduções', value: vDedTot > 0 ? formatMoeda(vDedTot) : '-' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Desconto Incondicionado', value: vDescInc > 0 ? formatMoeda(vDescInc) : '-' });
		y += 17;

		const vServ = Number(data.servico.valorServicos || 0);
		const bcIss = Math.max(0, vServ - vDedTot - vDescInc);
		const aliqIssStr = data.servico.aliquotaIss ? `${Number(data.servico.aliquotaIss).toFixed(2)}%` : '-';
		const retIssStr = data.servico.retencaoIss === '2' ? 'Retido na Fonte' : 'Não Retido';
		const vIssApurado = data.servico.valorIss ? formatMoeda(data.servico.valorIss) : (opSN === 3 ? 'Incluso no Simples' : '-');
		this.drawCell(doc, leftX, y, colW, 17, { label: 'BC ISSQN', value: formatMoeda(bcIss) });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'Alíquota Aplicada', value: aliqIssStr });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Retenção do ISSQN', value: retIssStr });
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'ISSQN Apurado', value: vIssApurado });
		y += 17;

		// ─── 9. TRIBUTAÇÃO FEDERAL (EXCETO CBS) (2 Linhas x 17 pt = 34 pt) ────
		const tf = data.tributosFederais || {};
		this.drawCell(doc, leftX, y, colW, 17, { label: 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)', isBlockTitle: true, labelFontSize: 5.5 });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'IRRF', value: tf.irrf ? formatMoeda(tf.irrf) : '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Contribuição Previdenciária - Retida', value: tf.inss ? formatMoeda(tf.inss) : '-' });
		const contribSoc = ((tf.csll || 0) + (tf.pis || 0) + (tf.cofins || 0));
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Contribuições Sociais - Retidas', value: contribSoc > 0 ? formatMoeda(contribSoc) : '-' });
		y += 17;

		this.drawCell(doc, leftX, y, colW, 17, { label: 'PIS - Débito Apuração Própria', value: '-' });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'COFINS - Débito Apuração Própria', value: '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW * 2, 17, {
			label: 'Descrição Contrib. Sociais - Retidas',
			value: tf.descContribSociais || (contribSoc > 0 ? 'PIS/COFINS/CSLL Retido na Fonte' : 'PIS/COFINS/CSLL Não Retido'),
		});
		y += 17;

		// ─── 10. TRIBUTAÇÃO IBS / CBS (4 Linhas x 17 pt = 68 pt) ───────────────
		const ibs = data.ibscbs || {};
		this.drawCell(doc, leftX, y, colW, 17, { label: 'TRIBUTAÇÃO IBS / CBS', isBlockTitle: true, labelFontSize: 6 });
		const cstTribStr = (ibs.cst || ibs.cClassTrib) ? `${ibs.cst || '-'} / ${ibs.cClassTrib || '-'}` : '- / -';
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'CST / cClassTrib', value: cstTribStr });
		this.drawCell(doc, leftX + colW * 2, y, colW * 2, 17, {
			label: 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF',
			value: '- / - / - / -',
		});
		y += 17;

		this.drawCell(doc, leftX, y, colW, 17, { label: 'Exclusões e Reduções da Base de Cálculo', value: '-' });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'Base de Cálculo Após Exclusões e Reduções', value: '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Red. Alíquota IBS / Red. Alíquota CBS', value: '- / -' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Alíquota - IBS UF / IBS Mun', value: '- / -' });
		y += 17;

		this.drawCell(doc, leftX, y, colW, 17, { label: 'Alíq. Efetiva Municipal - IBS', value: '-' });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'Valor Apurado Municipal - IBS', value: '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Alíq. Efetiva Estadual - IBS', value: '-' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Valor Apurado Estadual - IBS', value: '-' });
		y += 17;

		this.drawCell(doc, leftX, y, colW, 17, { label: 'Valor Total Apurado - IBS', value: '-' });
		this.drawCell(doc, leftX + colW, y, colW, 17, { label: 'Alíquota - CBS', value: '-' });
		this.drawCell(doc, leftX + colW * 2, y, colW, 17, { label: 'Alíquota Efetiva - CBS', value: '-' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 17, { label: 'Valor Total Apurado - CBS', value: '-' });
		y += 17;

		// ─── 11. VALOR TOTAL DA NFS-E (2 Linhas x 18 pt = 36 pt) ──────────────
		const totalRetFed = tf.totalRetencoes || ((tf.pis || 0) + (tf.cofins || 0) + (tf.inss || 0) + (tf.irrf || 0) + (tf.csll || 0));
		const totalRetIss = data.servico.retencaoIss === '2' ? (data.servico.valorIss || 0) : 0;
		const totalRetGeral = totalRetFed + totalRetIss;
		const vLiqNfse = Number(data.servico.valorLiquido ?? (vServ - vDescInc - totalRetGeral));

		this.drawCell(doc, leftX, y, colW, 18, { label: 'VALOR TOTAL DA NFS-E', isBlockTitle: true });
		this.drawCell(doc, leftX + colW, y, colW, 18, { label: 'VALOR DA OPERAÇÃO / SERVIÇO', value: formatMoeda(vServ), isBoldValue: true });
		this.drawCell(doc, leftX + colW * 2, y, colW, 18, { label: 'Desconto Incondicionado', value: vDescInc > 0 ? formatMoeda(vDescInc) : '-' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 18, { label: 'Desconto Condicionado', value: data.servico.descontoCondicionado ? formatMoeda(data.servico.descontoCondicionado) : '-' });
		y += 18;

		this.drawCell(doc, leftX, y, colW, 18, { label: 'Total das Retenções (ISSQN / Federais)', value: totalRetGeral > 0 ? formatMoeda(totalRetGeral) : '-' });
		this.drawCell(doc, leftX + colW, y, colW, 18, { label: 'VALOR LÍQUIDO DA NFS-e', value: formatMoeda(vLiqNfse), isBoldValue: true });
		this.drawCell(doc, leftX + colW * 2, y, colW, 18, { label: 'Total do IBS/CBS', value: '-' });
		this.drawCell(doc, leftX + colW * 3, y, colW, 18, {
			label: 'VALOR LÍQUIDO DA NFS-e + IBS/CBS',
			isShaded: true,
			value: formatMoeda(vLiqNfse),
			isBoldValue: true,
		});
		y += 18;

		// ─── 12. INFORMAÇÕES COMPLEMENTARES (Header 13 pt + Conteúdo 48 pt = 61 pt) ──
		this.drawCell(doc, leftX, y, pageWidth, 13, { label: 'INFORMAÇÕES COMPLEMENTARES', isBlockTitle: true, align: 'left', labelFontSize: 7 });
		y += 13;

		const infoPartes: string[] = [];
		if (data.informacoesComplementares && data.informacoesComplementares.trim()) {
			infoPartes.push(`Inf. Cont.: ${unescapeXml(data.informacoesComplementares.trim())}`);
		}
		infoPartes.push('Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: 13,45% ; Estaduais: 0,00% ; Municipais: 5,00%');
		const textoInfoCompl = infoPartes.join(' | ');

		this.drawCell(doc, leftX, y, pageWidth, 48, {
			value: textoInfoCompl,
			valueFontSize: 6.5,
		});
		y += 48;

		// ─── 13. CANHOTO (Picote + 1 Linha de 28 pt = 32 pt) ──────────────────
		y += 3;
		doc.save();
		doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).lineWidth(0.5).dash(3, { space: 2 }).stroke('#000000');
		doc.restore();
		y += 2;

		const canhotoH = 28;
		this.drawCell(doc, leftX, y, colW, canhotoH, {
			label: 'DATA CIENTIFICAÇÃO:',
			value: ' ',
		});
		this.drawCell(doc, leftX + colW, y, colW, canhotoH, {
			label: 'IDENTIFICAÇÃO E ASSINATURA',
			value: ' ',
		});
		this.drawCell(doc, leftX + colW * 2, y, colW * 2, canhotoH, {
			label: 'Nº NFS-e / CHAVE NFS-e',
			value: `${data.numeroNfse} / ${cleanKey}`,
			valueFontSize: 6.5,
			isBoldValue: true,
		});

		// ─── MARCA D'ÁGUA (Item 2.5.1 / 2.5.2 - CANCELADA / SUBSTITUÍDA) ───────
		if (isCancelada || isSubstituida) {
			const watermarkText = isCancelada ? 'CANCELADA' : 'SUBSTITUÍDA';
			doc.save();
			doc.rotate(-30, { origin: [297.6, 420.9] });
			doc.fillColor('#A6A6A6') // Cinza K35 conforme NT-008 item 2.5.1
				.fontSize(52)
				.font('Helvetica-Bold')
				.opacity(0.35)
				.text(watermarkText, 0, 395, {
					align: 'center',
					width: 595.28,
				});
			doc.restore();
		}

		// ─── BORDA EXTERNA DA PÁGINA (NT-008 Item 2.2.3: Borda de 1 pt) ───────
		doc.save();
		doc.rect(leftX, 14.17, pageWidth, y + canhotoH - 14.17).lineWidth(1).stroke('#000000');
		doc.restore();

		doc.end();

		return new Promise((resolve) => {
			doc.on('end', () => {
				resolve(Buffer.concat(chunks));
			});
		});
	}
}
