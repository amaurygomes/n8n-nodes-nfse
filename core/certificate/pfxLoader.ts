import * as fs from 'fs';
import * as forge from 'node-forge';

export interface ParsedCertificate {
	privateKeyPem: string;
	certificatePem: string;
	subject: string;
	issuer: string;
	serialNumber: string;
	validFrom: Date;
	validTo: Date;
	commonName?: string;
	cnpjCpf?: string;
}

export class PfxLoader {
	public static load(source: {
		base64?: string;
		path?: string;
		password?: string;
	}): ParsedCertificate {
		let pfxBuffer: Buffer;

		if (source.base64 && source.base64.trim()) {
			const cleanB64 = source.base64.replace(/\s+/g, '');
			pfxBuffer = Buffer.from(cleanB64, 'base64');
		} else if (source.path && source.path.trim()) {
			if (!fs.existsSync(source.path)) {
				throw new Error(`Arquivo de certificado não encontrado no caminho: ${source.path}`);
			}
			pfxBuffer = fs.readFileSync(source.path);
		} else {
			throw new Error('Nenhum certificado informado. Forneça o arquivo .pfx em Base64 ou o caminho em disco.');
		}

		const pfxDer = pfxBuffer.toString('binary');
		const pfxAsn1 = forge.asn1.fromDer(pfxDer);
		const password = source.password || '';

		const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

		let privateKeyPem = '';
		let certificatePem = '';
		let subject = '';
		let issuer = '';
		let serialNumber = '';
		let validFrom = new Date();
		let validTo = new Date();

		// Extrair Chave Privada
		for (const safeContent of p12.safeContents) {
			for (const safeBag of safeContent.safeBags) {
				if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) {
					if (safeBag.key) {
						privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
					}
				}
			}
		}

		let commonName = '';
		let cnpjCpf = '';

		// Extrair Certificado X.509
		for (const safeContent of p12.safeContents) {
			for (const safeBag of safeContent.safeBags) {
				if (safeBag.type === forge.pki.oids.certBag) {
					if (safeBag.cert) {
						const cert = safeBag.cert;
						certificatePem = forge.pki.certificateToPem(cert);
						subject = cert.subject.attributes.map((a: { shortName?: string; name?: string; value?: unknown }) => `${a.shortName || a.name}=${String(a.value)}`).join(', ');
						issuer = cert.issuer.attributes.map((a: { shortName?: string; name?: string; value?: unknown }) => `${a.shortName || a.name}=${String(a.value)}`).join(', ');
						serialNumber = cert.serialNumber;
						validFrom = cert.validity.notBefore;
						validTo = cert.validity.notAfter;

						for (const attr of cert.subject.attributes) {
							if (attr.shortName === 'CN' || attr.name === 'commonName') {
								commonName = String(attr.value || '');
								const matchDoc = commonName.match(/:([0-9A-Za-z]{11,14})$/);
								if (matchDoc) {
									cnpjCpf = matchDoc[1].toUpperCase();
								}
							}
						}
						break;
					}
				}
			}
			if (certificatePem) break;
		}

		if (!privateKeyPem || !certificatePem) {
			throw new Error('Falha ao extrair chave privada ou certificado X.509 do arquivo .pfx. Verifique se a senha está correta.');
		}

		if (new Date() > validTo) {
			throw new Error(`O certificado digital expirou em ${validTo.toISOString()}.`);
		}

		return {
			privateKeyPem,
			certificatePem,
			subject,
			issuer,
			serialNumber,
			validFrom,
			validTo,
			commonName: commonName || undefined,
			cnpjCpf: cnpjCpf || undefined,
		};
	}
}
