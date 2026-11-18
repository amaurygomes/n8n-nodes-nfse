import { SignedXml } from 'xml-crypto';
import { DOMParser, Element } from '@xmldom/xmldom';

export class XmlSigner {
	/**
	 * Assina digitalmente qualquer elemento identificado por Id conforme padrão ICP-Brasil XMLDSig
	 */
	public static signElement(
		xmlContent: string,
		tagName: string,
		privateKeyPem: string,
		certificatePem: string,
	): string {
		const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');

		const targetNodes = doc.getElementsByTagName(tagName);
		if (targetNodes.length === 0) {
			throw new Error(`Elemento <${tagName}> não encontrado no XML para assinatura digital.`);
		}

		const targetElement = targetNodes[0] as Element;
		const idAttribute = targetElement.getAttribute('Id');
		if (!idAttribute) {
			throw new Error(`Atributo Id não encontrado no elemento <${tagName}>.`);
		}

		// Limpar o certificado para obter o Base64 puro para a tag X509Certificate
		const cleanCertB64 = certificatePem
			.replace(/-----BEGIN CERTIFICATE-----/g, '')
			.replace(/-----END CERTIFICATE-----/g, '')
			.replace(/\r?\n|\r/g, '')
			.trim();

		const sig = new SignedXml({
			privateKey: privateKeyPem,
			publicCert: certificatePem,
			signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
			canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
		});

		// Adicionar referência com transforms Enveloped e C14N
		sig.addReference({
			xpath: `//*[@Id='${idAttribute}']`,
			transforms: [
				'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
				'http://www.w3.org/2001/10/xml-exc-c14n#',
			],
			digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
			isEmptyUri: false,
		});

		// Configurar KeyInfo com X509Certificate
		sig.getKeyInfoContent = () => {
			return `<X509Data><X509Certificate>${cleanCertB64}</X509Certificate></X509Data>`;
		};

		sig.computeSignature(xmlContent, {
			location: {
				reference: `//*[@Id='${idAttribute}']`,
				action: 'after',
			},
		});

		return sig.getSignedXml();
	}

	/**
	 * Assina digitalmente o elemento <infDPS Id="...">
	 */
	public static signDps(xmlContent: string, privateKeyPem: string, certificatePem: string): string {
		return this.signElement(xmlContent, 'infDPS', privateKeyPem, certificatePem);
	}

	/**
	 * Assina digitalmente o elemento de evento <infPedReg Id="...">
	 */
	public static signEvento(xmlContent: string, privateKeyPem: string, certificatePem: string): string {
		return this.signElement(xmlContent, 'infPedReg', privateKeyPem, certificatePem);
	}
}
