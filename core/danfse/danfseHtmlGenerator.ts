import * as QRCode from 'qrcode';
import {
	DanfseData,
	cleanRazaoSocial,
	formatCpfCnpj,
	unescapeXml,
	formatDateBr,
	formatMoeda,
} from './danfseGenerator';
import { loadLogoDataUri } from './logo';

export class DanfseHtmlGenerator {
	public static getDefaultTemplate(): string {
		return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8"/>
    <title>DANFSe v2.0 - NFS-e Nº {{numeroNota}}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 5mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 7pt;
            color: #000000;
            background: #ffffff;
            line-height: 1.15;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .danfse-container {
            width: 100%;
            max-width: 794px;
            margin: 0 auto;
            border: 1px solid #000000;
            background: #ffffff;
            position: relative;
        }
        table.tbl {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        table.tbl td, table.tbl th {
            border: 0.5px solid #000000;
            padding: 1.5px 3px;
            vertical-align: top;
            font-size: 7pt;
            overflow: hidden;
            word-wrap: break-word;
        }
        .shaded {
            background-color: #f2f2f2 !important;
        }
        .block-title {
            font-size: 7pt;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #f2f2f2 !important;
        }
        .lbl {
            font-size: 6pt;
            font-weight: bold;
            display: block;
            color: #000000;
            line-height: 1.1;
        }
        .lbl-caps {
            font-size: 7pt;
            font-weight: bold;
            display: block;
            color: #000000;
            text-transform: uppercase;
            line-height: 1.1;
        }
        .val {
            font-size: 7pt;
            font-weight: normal;
            color: #000000;
            display: block;
            line-height: 1.15;
        }
        .val-bold {
            font-size: 7pt;
            font-weight: bold;
            color: #000000;
            display: block;
            line-height: 1.15;
        }
        .val-red {
            color: #ff0000;
            font-weight: bold;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .qr-img {
            width: 60px;
            height: 60px;
            display: block;
            margin: 0 auto;
        }
        .qr-caption {
            font-size: 5.5pt;
            line-height: 1.15;
            text-align: center;
            margin-top: 3px;
        }
        .canhoto-divider {
            border: none;
            border-top: 1px dashed #000000;
            margin: 4px 0 2px 0;
            height: 1px;
        }
        .watermark {
            position: absolute;
            top: 40%;
            left: 5%;
            width: 90%;
            text-align: center;
            transform: rotate(-30deg);
            font-size: 52pt;
            font-weight: bold;
            color: #A6A6A6;
            opacity: 0.35;
            pointer-events: none;
            z-index: 1000;
            text-transform: uppercase;
            letter-spacing: 4px;
        }
    </style>
</head>
<body>

<div class="danfse-container">
    {{watermarkTag}}

    <!-- 1. CABEÇALHO OFICIAL (NT-008 Item 2.4.3 e Página 15) -->
    <table class="tbl">
        <tr>
            <td style="width: 20%;" class="shaded text-center">
                <img src="{{logoBase64}}" alt="Logo NFS-e" style="max-width: 110px; max-height: 38px; margin: 2px auto; display: block;"/>
            </td>
            <td style="width: 50%;" class="shaded text-center">
                <div style="font-size: 9pt; font-weight: bold;">DANFSe v2.0</div>
                <div style="font-size: 9pt; font-weight: bold;">Documento Auxiliar da NFS-e</div>
                {{homologacaoHeaderTag}}
            </td>
            <td style="width: 30%;" class="shaded text-left">
                <div style="font-size: 7.5pt;">Município: {{municipioEmissao}}</div>
                <div style="font-size: 6pt; margin-top: 2px;">Ambiente Gerador: Nacional</div>
                <div style="font-size: 6pt;">Tipo de Ambiente: {{tipoAmbienteTexto}}</div>
            </td>
        </tr>
    </table>

    <!-- 2. IDENTIFICAÇÃO E AUTENTICIDADE (NT-008 Item 2.1.2) -->
    <table class="tbl">
        <tr>
            <td colspan="3" style="width: 75%;">
                <span class="lbl-caps">CHAVE DE ACESSO DA NFS-E</span>
                <span class="val-bold">{{chaveAcessoFormatada}}</span>
            </td>
            <td rowspan="4" style="width: 25%; text-align: center; vertical-align: middle;">
                <img src="{{qrCodeBase64}}" alt="QR Code" class="qr-img"/>
                <div class="qr-caption">A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e</div>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl-caps">NÚMERO DA NFS-E</span>
                <span class="val-bold">{{numeroNota}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl-caps">COMPETÊNCIA DA NFS-E</span>
                <span class="val">{{competencia}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl-caps">DATA E HORA DA EMISSÃO DA NFS-E</span>
                <span class="val">{{dataEmissaoNfse}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl-caps">NÚMERO DA DPS</span>
                <span class="val">{{numeroDps}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl-caps">SÉRIE DA DPS</span>
                <span class="val">{{serieDps}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl-caps">DATA E HORA DA EMISSÃO DA DPS</span>
                <span class="val">{{dataEmissaoDps}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;" class="shaded">
                <span class="lbl-caps">EMITENTE DA NFS-e</span>
                <span class="val">Prestador</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl-caps">SITUAÇÃO DA NFS-e</span>
                <span class="{{situacaoClass}}">{{status}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl-caps">FINALIDADE</span>
                <span class="val">{{finalidade}}</span>
            </td>
        </tr>
    </table>

    <!-- 3. PRESTADOR / FORNECEDOR -->
    <table class="tbl">
        <tr>
            <td style="width: 25%;" class="block-title">PRESTADOR / FORNECEDOR</td>
            <td style="width: 25%;">
                <span class="lbl">CNPJ / CPF / NIF</span>
                <span class="val">{{prestadorCnpj}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Indicador Municipal (Inscrição)</span>
                <span class="val">{{inscricaoMunicipal}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Telefone</span>
                <span class="val">{{prestadorTelefone}}</span>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <span class="lbl">Nome / Nome Empresarial</span>
                <span class="val-bold">{{prestadorNome}}</span>
            </td>
            <td>
                <span class="lbl">Município / Sigla UF</span>
                <span class="val">{{municipioEmissao}}</span>
            </td>
            <td>
                <span class="lbl">Código IBGE / CEP</span>
                <span class="val">{{prestadorIbgeCep}}</span>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <span class="lbl">Endereço</span>
                <span class="val">{{prestadorEndereco}}</span>
            </td>
            <td colspan="2">
                <span class="lbl">E-mail</span>
                <span class="val">{{prestadorEmail}}</span>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <span class="lbl">Simples Nacional na Data de Competência</span>
                <span class="val">{{prestadorSimples}}</span>
            </td>
            <td colspan="2">
                <span class="lbl">Regime de Apuração Tributária pelo SN</span>
                <span class="val">{{prestadorRegimeSN}}</span>
            </td>
        </tr>
    </table>

    <!-- 4. TOMADOR / ADQUIRENTE -->
    {{tomadorSectionHtml}}

    <!-- 5. DESTINATÁRIO DA OPERAÇÃO -->
    {{destinatarioSectionHtml}}

    <!-- 6. INTERMEDIÁRIO DA OPERAÇÃO -->
    {{intermediarioSectionHtml}}

    <!-- 7. SERVIÇO PRESTADO -->
    <table class="tbl">
        <tr>
            <td style="width: 25%;" class="block-title">SERVIÇO PRESTADO</td>
            <td style="width: 25%;">
                <span class="lbl">Código de Tributação Nacional / Municipal</span>
                <span class="val">{{codigoTributacao}} / -</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Código da NBS</span>
                <span class="val">{{codigoNbs}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Local da Prestação / Sigla UF / País</span>
                <span class="val">{{localPrestacao}}</span>
            </td>
        </tr>
        <tr>
            <td colspan="4">
                <span class="lbl">Descrição do Código de Tributação Nacional / Municipal:</span>
                <span class="val" style="font-size: 6.5pt;">{{descTribNac}}</span>
            </td>
        </tr>
        <tr>
            <td colspan="4" style="min-height: 38px;">
                <span class="lbl">Descrição do Serviço</span>
                <span class="val" style="font-size: 6.5pt;">{{descricaoServico}}</span>
            </td>
        </tr>
    </table>

    <!-- 8. TRIBUTAÇÃO MUNICIPAL (ISSQN) -->
    <table class="tbl">
        <tr>
            <td style="width: 25%;" class="block-title">TRIBUTAÇÃO MUNICIPAL (ISSQN)</td>
            <td style="width: 25%;">
                <span class="lbl">Tipo de Tributação do ISSQN</span>
                <span class="val">{{tipoTributacaoIss}}</span>
            </td>
            <td colspan="2" style="width: 50%;">
                <span class="lbl">Município / Sigla UF / País da Incidência do ISSQN</span>
                <span class="val">{{municipioIncidencia}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">Regime Especial de Tributação do ISSQN</span>
                <span class="val">{{regimeEspecialIss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Tipo de Imunidade do ISSQN</span>
                <span class="val">{{tipoImunidadeIss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Suspensão da Exigibilidade do ISSQN</span>
                <span class="val">{{suspensaoIss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Número Processo Suspensão</span>
                <span class="val">{{numProcessoSuspensao}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">Benefício Municipal</span>
                <span class="val">{{beneficioMunicipal}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Cálculo do BM</span>
                <span class="val">{{calculoBm}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Total Deduções/Reduções</span>
                <span class="val">{{valorDeducoes}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Desconto Incondicionado</span>
                <span class="val">{{valorDesconto}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">BC ISSQN</span>
                <span class="val">{{bcIss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Alíquota Aplicada</span>
                <span class="val">{{aliquotaIss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Retenção do ISSQN</span>
                <span class="val">{{retencaoIss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">ISSQN Apurado</span>
                <span class="val">{{issqnValor}}</span>
            </td>
        </tr>
    </table>

    <!-- 9. TRIBUTAÇÃO FEDERAL (EXCETO CBS) -->
    <table class="tbl">
        <tr>
            <td style="width: 25%;" class="block-title">TRIBUTAÇÃO FEDERAL (EXCETO CBS)</td>
            <td style="width: 25%;">
                <span class="lbl">IRRF</span>
                <span class="val">{{vIrrf}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Contribuição Previdenciária - Retida</span>
                <span class="val">{{vInss}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Contribuições Sociais - Retidas</span>
                <span class="val">{{vContribSoc}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">PIS - Débito Apuração Própria</span>
                <span class="val">{{vPisDebito}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">COFINS - Débito Apuração Própria</span>
                <span class="val">{{vCofinsDebito}}</span>
            </td>
            <td colspan="2" style="width: 50%;">
                <span class="lbl">Descrição Contrib. Sociais - Retidas</span>
                <span class="val">{{descContribSoc}}</span>
            </td>
        </tr>
    </table>

    <!-- 10. TRIBUTAÇÃO IBS / CBS -->
    <table class="tbl">
        <tr>
            <td style="width: 25%;" class="block-title">TRIBUTAÇÃO IBS / CBS</td>
            <td style="width: 25%;">
                <span class="lbl">CST / cClassTrib</span>
                <span class="val">{{cstTribStr}}</span>
            </td>
            <td colspan="2" style="width: 50%;">
                <span class="lbl">Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF</span>
                <span class="val">{{indOperacaoStr}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">Exclusões e Reduções da Base de Cálculo</span>
                <span class="val">{{ibsExclusoes}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Base de Cálculo Após Exclusões e Reduções</span>
                <span class="val">{{ibsBaseCalculo}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Red. Alíquota IBS / Red. Alíquota CBS</span>
                <span class="val">{{ibsRedAliqStr}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Alíquota - IBS UF / IBS Mun</span>
                <span class="val">{{ibsAliqUfMunStr}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">Alíq. Efetiva Municipal - IBS</span>
                <span class="val">{{ibsAliqEfetivaMun}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Valor Apurado Municipal - IBS</span>
                <span class="val">{{ibsValorMun}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Alíq. Efetiva Estadual - IBS</span>
                <span class="val">{{ibsAliqEfetivaEst}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Valor Apurado Estadual - IBS</span>
                <span class="val">{{ibsValorEst}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">Valor Total Apurado - IBS</span>
                <span class="val">{{ibsValorTotal}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Alíquota - CBS</span>
                <span class="val">{{cbsAliquota}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Alíquota Efetiva - CBS</span>
                <span class="val">{{cbsAliqEfetiva}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Valor Total Apurado - CBS</span>
                <span class="val">{{cbsValorTotal}}</span>
            </td>
        </tr>
    </table>

    <!-- 11. VALOR TOTAL DA NFS-E -->
    <table class="tbl">
        <tr>
            <td style="width: 25%;" class="block-title">VALOR TOTAL DA NFS-E</td>
            <td style="width: 25%;">
                <span class="lbl">VALOR DA OPERAÇÃO / SERVIÇO</span>
                <span class="val-bold">{{valorServico}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Desconto Incondicionado</span>
                <span class="val">{{valorDesconto}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Desconto Condicionado</span>
                <span class="val">{{descontoCondicionado}}</span>
            </td>
        </tr>
        <tr>
            <td style="width: 25%;">
                <span class="lbl">Total das Retenções (ISSQN / Federais)</span>
                <span class="val">{{totalRetGeral}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">VALOR LÍQUIDO DA NFS-e</span>
                <span class="val-bold">{{valorLiquido}}</span>
            </td>
            <td style="width: 25%;">
                <span class="lbl">Total do IBS/CBS</span>
                <span class="val">{{totalIbsCbs}}</span>
            </td>
            <td style="width: 25%;" class="shaded">
                <span class="lbl">VALOR LÍQUIDO DA NFS-e + IBS/CBS</span>
                <span class="val-bold">{{valorLiquidoTotal}}</span>
            </td>
        </tr>
    </table>

    <!-- 12. INFORMAÇÕES COMPLEMENTARES -->
    <table class="tbl">
        <tr>
            <td class="block-title" style="padding: 2px 4px;">INFORMAÇÕES COMPLEMENTARES</td>
        </tr>
        <tr>
            <td style="min-height: 40px; font-size: 6.5pt; padding: 3px 4px;">
                {{textoInfoCompl}}
            </td>
        </tr>
    </table>

    <!-- 13. CANHOTO DE RECEBIMENTO -->
    <div class="canhoto-divider"></div>
    <table class="tbl" style="margin-top: 2px;">
        <tr>
            <td style="width: 25%; height: 26px; vertical-align: top;">
                <span class="lbl">DATA CIENTIFICAÇÃO:</span>
            </td>
            <td style="width: 45%; height: 26px; vertical-align: top;">
                <span class="lbl">IDENTIFICAÇÃO E ASSINATURA</span>
            </td>
            <td style="width: 30%; height: 26px; vertical-align: top;">
                <span class="lbl">Nº NFS-e / CHAVE NFS-e</span>
                <span class="val-bold" style="font-size: 6.5pt;">{{numeroNota}} / {{chaveAcesso}}</span>
            </td>
        </tr>
    </table>

</div>

</body>
</html>`;
	}

	public static async renderHtml(data: DanfseData, customTemplate?: string): Promise<string> {
		const isHomologacao =
			String(data.ambiente).toLowerCase().includes('homolog') ||
			data.ambiente === '2';
		const isCancelada = (data.status || '').toUpperCase() === 'CANCELADA';
		const isSubstituida =
			(data.status || '').toUpperCase() === 'SUBSTITUIDA' ||
			(data.status || '').toUpperCase() === 'SUBSTITUÍDA';

		const isMaskedKey = Boolean(data.chaveAcesso && data.chaveAcesso.includes('*'));
		const cleanKey = isMaskedKey ? data.chaveAcesso : (data.chaveAcesso ? data.chaveAcesso.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : '');
		const formattedKey = isMaskedKey ? data.chaveAcesso : cleanKey.replace(/(\d{4})/g, '$1 ').trim();
		const qrCodeUrl = isMaskedKey
			? 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=00000000000000000000000000000000000000000000000000'
			: `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${cleanKey}`;
		const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, { width: 130, margin: 0 });

		const prestadorNome = cleanRazaoSocial(data.prestador.razaoSocial);
		const prestadorMun = data.prestador.municipio && data.prestador.municipio !== 'Município Emissor'
			? unescapeXml(data.prestador.municipio)
			: 'Dourados';
		const prestadorUf = data.prestador.uf && data.prestador.uf !== 'UF'
			? unescapeXml(data.prestador.uf)
			: 'MS';

		const emissaoStr = data.dataEmissao || formatDateBr(new Date().toISOString().split('T')[0]);
		const compStr = formatDateBr(data.competencia) || emissaoStr.split(' ')[0];

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

		const partesEndPrest: string[] = [];
		if (data.prestador.logradouro) partesEndPrest.push(unescapeXml(data.prestador.logradouro));
		if (data.prestador.numero) partesEndPrest.push(unescapeXml(data.prestador.numero));
		if (data.prestador.complemento) partesEndPrest.push(unescapeXml(data.prestador.complemento));
		if (data.prestador.bairro) partesEndPrest.push(unescapeXml(data.prestador.bairro));
		const endPrestadorStr = partesEndPrest.join(', ') || '-';

		const ibgePrest = data.prestador.codigoIbge || '-';
		const cepPrest = data.prestador.cep ? data.prestador.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '-';
		const prestadorIbgeCep = `${ibgePrest} / ${cepPrest}`;

		// Tomador Section
		const rawTomadorNome = unescapeXml(data.tomador.nome);
		const hasTomador = Boolean(data.tomador.cpfCnpj || (rawTomadorNome && rawTomadorNome !== 'Consumidor Final'));
		let tomadorSectionHtml = '';
		if (!hasTomador && data.tomador.naoIdentificado) {
			tomadorSectionHtml = `
            <table class="tbl">
                <tr>
                    <td style="width: 25%;" class="block-title">TOMADOR / ADQUIRENTE</td>
                    <td colspan="3" style="width: 75%;">
                        <span class="val">TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</span>
                    </td>
                </tr>
            </table>`;
		} else {
			const munToma = unescapeXml(data.tomador.municipio) || '-';
			const ufToma = unescapeXml(data.tomador.uf) || '-';
			const munUfToma = munToma !== '-' ? `${munToma} / ${ufToma}` : '-';
			const ibgeToma = data.tomador.codigoIbge || '-';
			const cepToma = data.tomador.cep ? data.tomador.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '-';
			const ibgeCepToma = ibgeToma !== '-' || cepToma !== '-' ? `${ibgeToma} / ${cepToma}` : '-';

			const partesEndToma: string[] = [];
			if (data.tomador.logradouro) partesEndToma.push(unescapeXml(data.tomador.logradouro));
			if (data.tomador.numero) partesEndToma.push(unescapeXml(data.tomador.numero));
			if (data.tomador.complemento) partesEndToma.push(unescapeXml(data.tomador.complemento));
			if (data.tomador.bairro) partesEndToma.push(unescapeXml(data.tomador.bairro));
			const endTomaStr = partesEndToma.join(', ') || '-';

			tomadorSectionHtml = `
            <table class="tbl">
                <tr>
                    <td style="width: 25%;" class="block-title">TOMADOR / ADQUIRENTE</td>
                    <td style="width: 25%;">
                        <span class="lbl">CNPJ / CPF / NIF</span>
                        <span class="val">${formatCpfCnpj(data.tomador.cpfCnpj)}</span>
                    </td>
                    <td style="width: 25%;">
                        <span class="lbl">Indicador Municipal (Inscrição)</span>
                        <span class="val">${unescapeXml(data.tomador.inscricaoMunicipal) || '-'}</span>
                    </td>
                    <td style="width: 25%;">
                        <span class="lbl">Telefone</span>
                        <span class="val">${formatPhone(data.tomador.telefone)}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Nome / Nome Empresarial</span>
                        <span class="val-bold">${rawTomadorNome || 'Consumidor Final'}</span>
                    </td>
                    <td>
                        <span class="lbl">Município / Sigla UF</span>
                        <span class="val">${munUfToma}</span>
                    </td>
                    <td>
                        <span class="lbl">Código IBGE / CEP</span>
                        <span class="val">${ibgeCepToma}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Endereço</span>
                        <span class="val">${endTomaStr}</span>
                    </td>
                    <td colspan="2">
                        <span class="lbl">E-mail</span>
                        <span class="val">${unescapeXml(data.tomador.email) || '-'}</span>
                    </td>
                </tr>
            </table>`;
		}

		// Destinatário Section
		const hasCustomDest = Boolean(data.destinatario && !data.destinatario.isTomador && (data.destinatario.nome || data.destinatario.cpfCnpj));
		let destinatarioSectionHtml = '';
		if (!hasCustomDest) {
			destinatarioSectionHtml = `
            <table class="tbl">
                <tr>
                    <td style="width: 25%;" class="block-title">DESTINATÁRIO DA OPERAÇÃO</td>
                    <td colspan="3" style="width: 75%;">
                        <span class="val">O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO</span>
                    </td>
                </tr>
            </table>`;
		} else {
			destinatarioSectionHtml = `
            <table class="tbl">
                <tr>
                    <td style="width: 25%;" class="block-title">DESTINATÁRIO DA OPERAÇÃO</td>
                    <td style="width: 25%;">
                        <span class="lbl">CNPJ / CPF / NIF</span>
                        <span class="val">${formatCpfCnpj(data.destinatario?.cpfCnpj)}</span>
                    </td>
                    <td style="width: 25%;">
                        <span class="lbl">Indicador Municipal (Inscrição)</span>
                        <span class="val">-</span>
                    </td>
                    <td style="width: 25%;">
                        <span class="lbl">Telefone</span>
                        <span class="val">${formatPhone(data.destinatario?.telefone)}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Nome / Nome Empresarial</span>
                        <span class="val-bold">${unescapeXml(data.destinatario?.nome) || '-'}</span>
                    </td>
                    <td>
                        <span class="lbl">Município / Sigla UF</span>
                        <span class="val">${unescapeXml(data.destinatario?.municipio) || '-'} / ${unescapeXml(data.destinatario?.uf) || '-'}</span>
                    </td>
                    <td>
                        <span class="lbl">Código IBGE / CEP</span>
                        <span class="val">${data.destinatario?.codigoIbge || '-'} / ${data.destinatario?.cep || '-'}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Endereço</span>
                        <span class="val">${unescapeXml(data.destinatario?.logradouro) || '-'}</span>
                    </td>
                    <td colspan="2">
                        <span class="lbl">E-mail</span>
                        <span class="val">${unescapeXml(data.destinatario?.email) || '-'}</span>
                    </td>
                </tr>
            </table>`;
		}

		// Intermediário Section
		const hasInterm = Boolean(data.intermediario && (data.intermediario.nome || data.intermediario.cpfCnpj));
		let intermediarioSectionHtml = '';
		if (!hasInterm) {
			intermediarioSectionHtml = `
            <table class="tbl">
                <tr>
                    <td style="width: 25%;" class="block-title">INTERMEDIÁRIO DA OPERAÇÃO</td>
                    <td colspan="3" style="width: 75%;">
                        <span class="val">INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</span>
                    </td>
                </tr>
            </table>`;
		} else {
			intermediarioSectionHtml = `
            <table class="tbl">
                <tr>
                    <td style="width: 25%;" class="block-title">INTERMEDIÁRIO DA OPERAÇÃO</td>
                    <td style="width: 25%;">
                        <span class="lbl">CNPJ / CPF / NIF</span>
                        <span class="val">${formatCpfCnpj(data.intermediario?.cpfCnpj)}</span>
                    </td>
                    <td style="width: 25%;">
                        <span class="lbl">Indicador Municipal (Inscrição)</span>
                        <span class="val">${unescapeXml(data.intermediario?.inscricaoMunicipal) || '-'}</span>
                    </td>
                    <td style="width: 25%;">
                        <span class="lbl">Telefone</span>
                        <span class="val">${formatPhone(data.intermediario?.telefone)}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Nome / Nome Empresarial</span>
                        <span class="val-bold">${unescapeXml(data.intermediario?.nome) || '-'}</span>
                    </td>
                    <td>
                        <span class="lbl">Município / Sigla UF</span>
                        <span class="val">${unescapeXml(data.intermediario?.municipio) || '-'} / ${unescapeXml(data.intermediario?.uf) || '-'}</span>
                    </td>
                    <td>
                        <span class="lbl">Código IBGE / CEP</span>
                        <span class="val">${data.intermediario?.codigoIbge || '-'} / ${data.intermediario?.cep || '-'}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="lbl">Endereço</span>
                        <span class="val">${unescapeXml(data.intermediario?.logradouro) || '-'}</span>
                    </td>
                    <td colspan="2">
                        <span class="lbl">E-mail</span>
                        <span class="val">${unescapeXml(data.intermediario?.email) || '-'}</span>
                    </td>
                </tr>
            </table>`;
		}

		// Values & Calculations
		const vServNum = Number(data.servico.valorServicos || 0);
		const vDescIncNum = Number(data.servico.valorDesconto || 0);
		const vDedTotNum = Number(data.servico.valorDeducoes || 0);

		const tf = data.tributosFederais || {};
		const totalRetFedNum = tf.totalRetencoes || ((tf.pis || 0) + (tf.cofins || 0) + (tf.inss || 0) + (tf.irrf || 0) + (tf.csll || 0));
		const totalRetIssNum = data.servico.retencaoIss === '2' ? (data.servico.valorIss || 0) : 0;
		const totalRetGeralNum = totalRetFedNum + totalRetIssNum;
		const vLiqNfseNum = Number(data.servico.valorLiquido ?? (vServNum - vDescIncNum - totalRetGeralNum));

		const bcIssNum = Math.max(0, vServNum - vDedTotNum - vDescIncNum);
		const aliqIssStr = data.servico.aliquotaIss ? `${Number(data.servico.aliquotaIss).toFixed(2)}%` : '-';
		const retIssStr = data.servico.retencaoIss === '2' ? 'Retido na Fonte' : 'Não Retido';
		const vIssApuradoStr = data.servico.valorIss ? formatMoeda(data.servico.valorIss) : (opSN === 3 ? 'Incluso no Simples' : '-');

		const contribSoc = ((tf.csll || 0) + (tf.pis || 0) + (tf.cofins || 0));

		// IBS / CBS
		const ibs = data.ibscbs || {};
		const cstTribStr = (ibs.cst || ibs.cClassTrib) ? `${ibs.cst || '-'} / ${ibs.cClassTrib || '-'}` : '- / -';

		// Complementares
		const infoPartes: string[] = [];
		if (data.informacoesComplementares && data.informacoesComplementares.trim()) {
			infoPartes.push(`Inf. Cont.: ${unescapeXml(data.informacoesComplementares.trim())}`);
		}
		infoPartes.push('Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: 13,45% ; Estaduais: 0,00% ; Municipais: 5,00%');
		const textoInfoCompl = infoPartes.join(' | ');

		const cTribFormatted = data.servico.codigoTributacao
			? data.servico.codigoTributacao.replace(/(\d{2})(\d{2})(\d{2})/, '$1.$2.$3')
			: '01.03.01';

		const homologacaoHeaderTag = isHomologacao
			? '<div style="font-size: 9pt; font-weight: bold; color: #ff0000; margin-top: 2px;">NFS-e SEM VALIDADE JURÍDICA</div>'
			: '';

		const watermarkTag = (isCancelada || isSubstituida)
			? `<div class="watermark">${isCancelada ? 'CANCELADA' : 'SUBSTITUÍDA'}</div>`
			: '';

		const template = customTemplate && customTemplate.trim() ? customTemplate : this.getDefaultTemplate();

		let html = template;
		html = html.replace(/\{\{\s*numeroNota\s*\}\}/g, data.numeroNfse || '-');
		html = html.replace(/\{\{\s*serieDps\s*\}\}/g, data.serie || '1');
		html = html.replace(/\{\{\s*numeroDps\s*\}\}/g, data.dpsNumero || data.numeroNfse || '-');
		html = html.replace(/\{\{\s*dataEmissaoNfse\s*\}\}/g, emissaoStr);
		html = html.replace(/\{\{\s*dataEmissaoDps\s*\}\}/g, data.dataEmissaoDps || emissaoStr);
		html = html.replace(/\{\{\s*dataEmissao\s*\}\}/g, emissaoStr);
		html = html.replace(/\{\{\s*competencia\s*\}\}/g, compStr);
		html = html.replace(/\{\{\s*finalidade\s*\}\}/g, data.finalidade || 'NFS-e regular');
		html = html.replace(/\{\{\s*status\s*\}\}/g, isCancelada ? 'CANCELADA' : 'AUTORIZADA');
		html = html.replace(/\{\{\s*situacaoClass\s*\}\}/g, isCancelada ? 'val-red' : 'val-bold');
		html = html.replace(/\{\{\s*watermarkTag\s*\}\}/g, watermarkTag);
		html = html.replace(/\{\{\s*watermarkCanceladaTag\s*\}\}/g, watermarkTag);
		html = html.replace(/\{\{\s*homologacaoHeaderTag\s*\}\}/g, homologacaoHeaderTag);
		html = html.replace(/\{\{\s*homologacaoBanner\s*\}\}/g, homologacaoHeaderTag);
		html = html.replace(/\{\{\s*tipoAmbienteTexto\s*\}\}/g, isHomologacao ? '2 - Homologação' : '1 - Produção');
		html = html.replace(/\{\{\s*logoBase64\s*\}\}/g, loadLogoDataUri());
		html = html.replace(/\{\{\s*chaveAcesso\s*\}\}/g, cleanKey);
		html = html.replace(/\{\{\s*chaveAcessoFormatada\s*\}\}/g, formattedKey);
		html = html.replace(/\{\{\s*qrCodeBase64\s*\}\}/g, qrCodeDataUrl);

		// Prestador
		html = html.replace(/\{\{\s*prestadorNome\s*\}\}/g, prestadorNome);
		html = html.replace(/\{\{\s*prestadorCnpj\s*\}\}/g, formatCpfCnpj(data.prestador.cnpj));
		html = html.replace(/\{\{\s*inscricaoMunicipal\s*\}\}/g, unescapeXml(data.prestador.inscricaoMunicipal) || '-');
		html = html.replace(/\{\{\s*prestadorTelefone\s*\}\}/g, formatPhone(data.prestador.telefone));
		html = html.replace(/\{\{\s*municipioEmissao\s*\}\}/g, `${prestadorMun} - ${prestadorUf}`);
		html = html.replace(/\{\{\s*prestadorIbgeCep\s*\}\}/g, prestadorIbgeCep);
		html = html.replace(/\{\{\s*prestadorEndereco\s*\}\}/g, endPrestadorStr);
		html = html.replace(/\{\{\s*prestadorEmail\s*\}\}/g, unescapeXml(data.prestador.email) || '-');
		html = html.replace(/\{\{\s*prestadorSimples\s*\}\}/g, snText);
		html = html.replace(/\{\{\s*prestadorRegimeSN\s*\}\}/g, regApText);
		html = html.replace(/\{\{\s*prestadorRegime\s*\}\}/g, snText);

		// Sections
		html = html.replace(/\{\{\s*tomadorSectionHtml\s*\}\}/g, tomadorSectionHtml);
		html = html.replace(/\{\{\s*destinatarioSectionHtml\s*\}\}/g, destinatarioSectionHtml);
		html = html.replace(/\{\{\s*intermediarioSectionHtml\s*\}\}/g, intermediarioSectionHtml);

		// Tomador legacy
		html = html.replace(/\{\{\s*tomadorNome\s*\}\}/g, rawTomadorNome || 'Consumidor Final');
		html = html.replace(/\{\{\s*tomadorCpfCnpj\s*\}\}/g, formatCpfCnpj(data.tomador.cpfCnpj));
		html = html.replace(/\{\{\s*tomadorEmail\s*\}\}/g, unescapeXml(data.tomador.email) || '-');
		html = html.replace(/\{\{\s*tomadorMunicipio\s*\}\}/g, unescapeXml(data.tomador.municipio) || '-');

		// Servico
		html = html.replace(/\{\{\s*codigoTributacao\s*\}\}/g, cTribFormatted);
		html = html.replace(/\{\{\s*codigoNbs\s*\}\}/g, data.servico.codigoNbs || '-');
		const locPrest = data.servico.municipioPrestacao || `${prestadorMun} / ${prestadorUf}`;
		html = html.replace(/\{\{\s*localPrestacao\s*\}\}/g, `${locPrest} / BR`);
		const descTribNac = data.servico.discriminacaoTributacao || '-';
		html = html.replace(/\{\{\s*descTribNac\s*\}\}/g, descTribNac);
		html = html.replace(/\{\{\s*descricaoServico\s*\}\}/g, unescapeXml(data.servico.descricao) || '-');
		html = html.replace(/\{\{\s*cnae\s*\}\}/g, data.servico.cnae || '-');

		// ISSQN
		html = html.replace(/\{\{\s*tipoTributacaoIss\s*\}\}/g, data.servico.tipoTributacaoIss || 'Operação Tributável');
		html = html.replace(/\{\{\s*municipioIncidencia\s*\}\}/g, `${prestadorMun} / ${prestadorUf} / BR`);
		html = html.replace(/\{\{\s*regimeEspecialIss\s*\}\}/g, data.servico.regimeEspecialIss || '-');
		html = html.replace(/\{\{\s*tipoImunidadeIss\s*\}\}/g, data.servico.tipoImunidadeIss || '-');
		html = html.replace(/\{\{\s*suspensaoIss\s*\}\}/g, data.servico.suspensaoIss || '-');
		html = html.replace(/\{\{\s*numProcessoSuspensao\s*\}\}/g, data.servico.numProcessoSuspensao || '-');
		html = html.replace(/\{\{\s*beneficioMunicipal\s*\}\}/g, data.servico.beneficioMunicipal || '-');
		html = html.replace(/\{\{\s*calculoBm\s*\}\}/g, data.servico.calculoBm ? formatMoeda(data.servico.calculoBm) : '-');
		html = html.replace(/\{\{\s*valorDeducoes\s*\}\}/g, vDedTotNum > 0 ? formatMoeda(vDedTotNum) : '-');
		html = html.replace(/\{\{\s*valorDesconto\s*\}\}/g, vDescIncNum > 0 ? formatMoeda(vDescIncNum) : '-');
		html = html.replace(/\{\{\s*bcIss\s*\}\}/g, formatMoeda(bcIssNum));
		html = html.replace(/\{\{\s*aliquotaIss\s*\}\}/g, aliqIssStr);
		html = html.replace(/\{\{\s*retencaoIss\s*\}\}/g, retIssStr);
		html = html.replace(/\{\{\s*issqnValor\s*\}\}/g, vIssApuradoStr);

		// Federal
		html = html.replace(/\{\{\s*vIrrf\s*\}\}/g, tf.irrf ? formatMoeda(tf.irrf) : '-');
		html = html.replace(/\{\{\s*vInss\s*\}\}/g, tf.inss ? formatMoeda(tf.inss) : '-');
		html = html.replace(/\{\{\s*vContribSoc\s*\}\}/g, contribSoc > 0 ? formatMoeda(contribSoc) : '-');
		html = html.replace(/\{\{\s*vPisDebito\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*vCofinsDebito\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*descContribSoc\s*\}\}/g, tf.descContribSociais || (contribSoc > 0 ? 'PIS/COFINS/CSLL Retido na Fonte' : 'PIS/COFINS/CSLL Não Retido'));

		// IBS / CBS
		html = html.replace(/\{\{\s*cstTribStr\s*\}\}/g, cstTribStr);
		html = html.replace(/\{\{\s*indOperacaoStr\s*\}\}/g, '- / - / - / -');
		html = html.replace(/\{\{\s*ibsExclusoes\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*ibsBaseCalculo\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*ibsRedAliqStr\s*\}\}/g, '- / -');
		html = html.replace(/\{\{\s*ibsAliqUfMunStr\s*\}\}/g, '- / -');
		html = html.replace(/\{\{\s*ibsAliqEfetivaMun\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*ibsValorMun\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*ibsAliqEfetivaEst\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*ibsValorEst\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*ibsValorTotal\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*cbsAliquota\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*cbsAliqEfetiva\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*cbsValorTotal\s*\}\}/g, '-');

		// Totais
		html = html.replace(/\{\{\s*valorServico\s*\}\}/g, formatMoeda(vServNum));
		html = html.replace(/\{\{\s*descontoCondicionado\s*\}\}/g, data.servico.descontoCondicionado ? formatMoeda(data.servico.descontoCondicionado) : '-');
		html = html.replace(/\{\{\s*totalRetGeral\s*\}\}/g, totalRetGeralNum > 0 ? formatMoeda(totalRetGeralNum) : '-');
		html = html.replace(/\{\{\s*valorLiquido\s*\}\}/g, formatMoeda(vLiqNfseNum));
		html = html.replace(/\{\{\s*totalIbsCbs\s*\}\}/g, '-');
		html = html.replace(/\{\{\s*valorLiquidoTotal\s*\}\}/g, formatMoeda(vLiqNfseNum));

		// Complementares
		html = html.replace(/\{\{\s*textoInfoCompl\s*\}\}/g, textoInfoCompl);

		return html;
	}
}

function formatPhone(phone?: string): string {
	if (!phone) return '-';
	const clean = phone.replace(/\D/g, '');
	if (clean.length === 11) return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
	if (clean.length === 10) return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
	return phone;
}
