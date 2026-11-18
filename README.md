# n8n-nodes-nfse

<img src="nodes/NfseNacional/nfseNacional.svg" width="110" alt="NFS-e Nacional Logo">

[![npm version](https://img.shields.io/npm/v/n8n-nodes-nfse.svg)](https://www.npmjs.com/package/n8n-nodes-nfse)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-EA4B71.svg)](https://n8n.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Emissor **100% nativo em TypeScript/Node.js** para a **NFS-e Padrão Nacional (SEFIN Nacional / ADN da Receita Federal)** no **n8n**.

Realiza toda a leitura do **Certificado Digital A1 (`.pfx`/`.p12`)**, assinatura digital **ICP-Brasil (XMLDSig)**, transmissão segura **mTLS** e geração local do **DANFSE em PDF e HTML** diretamente no workflow — sem depender de APIs intermediárias pagas, DLLs externas, ACBr ou containers auxiliares.

---

## 🚀 Consultoria e Implantação

Este projeto é **Open Source (Licença MIT)** e totalmente livre para uso pessoal e comercial.

Se você é empresário, agência ou contabilidade e precisa de **apoio especializado para implantar a automação fiscal na sua operação** (integração com Stripe, Asaas, Hotmart, Shopify, WooCommerce, ERPs, etc.), entre em contato:

- 💼 **Responsável:** Amaury Gomes Ibanez
- 🌐 **Site:** [agnez.com.br](https://agnez.com.br)
- 📱 **WhatsApp:** [+55 (67) 99104-4105](https://wa.me/5567991044105)

---

## ⚡ Principais Recursos

- 🇧🇷 **Padrão Nacional Oficial:** Comunicação direta com a SEFIN Nacional da Receita Federal (Produção e Produção Restrita / Homologação).
- 🔐 **Certificado Digital A1 Nativo (`.pfx` / `.p12`):** Suporte via Base64 (ideal para Docker/Cloud) ou caminho de arquivo local.
- ✍️ **Assinatura Digital ICP-Brasil (XMLDSig):** Assinatura de `<infDPS>` e `<infPedReg>` com `RSA-SHA256` e `C14N` conforme especificação técnica vigente.
- 🌐 **Autenticação Mútua (mTLS):** Conexão HTTPS autenticada com a chave privada e certificado X.509 ICP-Brasil.
- 📄 **DANFSE em PDF e HTML:** Geração local do espelho oficial da NFS-e com QR Code de verificação pública da Receita Federal e suporte a modo de ocultação de dados sigilosos (para demonstrações/gravações).
- 🌍 **Suporte Completo:** CNPJ numérico ou alfanumérico (IN RFB 2.229/2024), tomador no exterior (NIF), retenções federais (PIS, COFINS, CSLL, IRRF, INSS), ISSQN e tags da Reforma Tributária (IBS/CBS - LC 214/2025).

---

## 📦 Instalação

### Pela interface do n8n (Community Nodes):
1. No seu n8n, acesse **Settings (Configurações)** > **Community Nodes**.
2. Clique em **Install a community node**.
3. Informe o pacote:
   ```text
   n8n-nodes-nfse
   ```
4. Marque a confirmação e clique em **Install**.

---

## 🔐 Passo 1: Configurando a Credencial

No n8n, crie uma nova credencial do tipo **NFS-e Nacional (Certificado A1 & SEFIN)**.

### Como converter seu certificado `.pfx` para Base64 (Recomendado)

Para evitar problemas de volume/permissão em containers Docker, converta seu arquivo `.pfx` em uma string Base64:

- **No Linux / macOS:**
  ```bash
  base64 -w 0 seu_certificado.pfx
  # (no macOS use: base64 -i seu_certificado.pfx | tr -d '\n')
  ```
- **No Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\seu_certificado.pfx")) | Set-Clipboard
  ```
  *(O comando acima já copia o Base64 direto para a sua área de transferência `Ctrl+V`).*

### Campos da Credencial

| Campo | Obrigatório | Descrição |
| :--- | :---: | :--- |
| **Formato do Certificado A1** | Sim | Escolha **Certificado em Base64** (recomendado) ou **Caminho do Arquivo (.pfx no Servidor)**. |
| **Certificado A1 / Caminho** | Sim | Cole a string Base64 do `.pfx` ou informe o caminho absoluto no container (ex: `/certs/empresa.pfx`). |
| **Senha do Certificado A1** | Sim | Senha de proteção do arquivo `.pfx`. |
| **CNPJ do Prestador (Emitente)** | Sim | CNPJ de 14 caracteres da empresa emitente. |
| **Código do Município Emissor (IBGE)** | Sim | Código IBGE de **7 dígitos** da prefeitura do prestador (ex: `3550308` para São Paulo, `5003702` para Dourados). |
| **Razão Social da Empresa** | Sim | Nome empresarial exibido no cabeçalho do DANFSE. |
| **Nome do Município e UF** | Sim | Ex: `São Paulo - SP` (usado na impressão do DANFSE). |
| **CNAE Principal** | Sim | Código CNAE principal da empresa (ex: `6201-5/01`). |
| **Inscrição Municipal / E-mail / Telefone / Endereço / CEP** | Não | Dados complementares do prestador para exibição completa no PDF/HTML do DANFSE. |
| **Regime Tributário da Empresa** | Sim | `1 - Não Optante (Lucro Presumido/Real)`, `2 - Simples Nacional (MEI)` ou `3 - Simples Nacional (ME/EPP)`. |
| **Ambiente Padrão** | Sim | `2 - Homologação` (testes sem valor fiscal), `1 - Produção` (notas oficiais) ou `3 - Customizado` (proxy próprio). |

---

## 🛠️ Passo 2: Utilizando as Operações

O nó **NFS-e Nacional** possui **6 operações** principais:

| Operação | O que faz | Principais Saídas |
| :--- | :--- | :--- |
| **Emitir NFS-e (Enviar DPS)** | Monta o XML da DPS, assina com o Certificado A1, comprime em GZIP Base64 e transmite à SEFIN Nacional. | `sucesso`, `status`, `chaveAcesso`, `numeroNfse`, `danfseUrl`, `xmlDpsAssinado`, `xmlNfseAutorizado` (+ PDF/HTML opcional). |
| **Substituir NFS-e** | Emite uma nova NFS-e substituindo uma nota anterior (informando a chave de 50 dígitos da nota substituída e o motivo). | Mesmas saídas da emissão, vinculando o cancelamento por substituição da nota anterior. |
| **Consultar NFS-e por Chave** | Consulta uma NFS-e pela **Chave de Acesso (50 dígitos)** e baixa o XML oficial autorizado. | Status atual (`AUTORIZADA` / `CANCELADA`), dados extraídos, `xmlNfse` e PDF/HTML opcional. |
| **Consultar Processamento do DPS** | Consulta o resultado de um DPS pelo **ID da DPS (42 caracteres)** ou número. | Status do processamento, `chaveAcesso`, `numeroNfse`, `xmlNfse` e PDF/HTML opcional. |
| **Cancelar NFS-e (Evento 101101)** | Gera, assina e transmite o pedido oficial de cancelamento (`e101101`) para a SEFIN Nacional. | `sucesso`, `status`, `mensagemRetorno`, `xmlEventoAssinado` e `xmlEventoHomologado`. |
| **Consultar Eventos da NFS-e** | Consulta eventos vinculados a uma nota (ex: `101101` Cancelamento ou `105102` Substituição). | Dados do evento homologado e XML descompactado (`xmlEvento`). |
| **Gerar DANFSE (PDF / HTML)** | Gera o documento fiscal (DANFSE) em **PDF**, **HTML** ou **Ambos**, a partir da chave/XML ou de preenchimento manual. | Binários `danfse` (`.pdf`) e/ou `danfse_html` (`.html`), além de `danfseHtml` no JSON. |

---

## 💡 Guia Rápido de Uso

### 1. Emitindo uma NFS-e
1. Selecione a operação **Emitir NFS-e (Enviar DPS)** e o modo **Formulário Simples (Campos Visuais)**.
2. Preencha os campos principais:
   - **Nome / Razão Social do Tomador:** Nome do cliente (ex: `={{ $json.nome }}`).
   - **CPF ou CNPJ do Tomador:** Documento do cliente (com ou sem pontuação).
   - **Valor do Serviço (R$):** Valor bruto da nota (ex: `1500.00`).
   - **Descrição dos Serviços:** Discriminação detalhada do serviço prestado.
   - **Código de Tributação Nacional (`cTribNac`):** Código de **6 dígitos** da lista nacional de serviços (ex: `010301`).
   - **Município de Prestação (IBGE):** Deixe vazio para usar automaticamente o município da sua credencial, ou informe os 7 dígitos do IBGE se o serviço foi prestado em outra cidade.
   - **Série da DPS** e **Número da DPS (`nDPS`):** Informe a numeração controlada pelo seu sistema (se deixar o Número da DPS vazio, o nó gera um sequencial baseado no timestamp).
   - **Opção Pelo Simples Nacional:** Deixe em **Usar Padrão da Credencial** para seguir o regime já configurado na sua credencial.
3. *(Opcional)* Em **Campos Adicionais**, você pode:
   - Ativar **Gerar DANFSE em PDF** ou **Gerar DANFSE em HTML** para que a emissão já devolva o arquivo pronto para envio por e-mail/WhatsApp.
   - Informar endereço do tomador, e-mail, telefone, alíquota de ISS, retenções federais (`PIS`, `COFINS`, `IRRF`, `CSLL`, `INSS`), código `NBS`, `TXID do Pix` ou dados de **Tomador no Exterior (`NIF`)**.

### 2. Gerando o PDF / HTML do DANFSE separadamente
- Na operação **Gerar DANFSE (PDF / HTML)**:
  - **Modo Automático (Recomendado):** Informe apenas a **Chave de Acesso (50 Dígitos)** (ex: `={{ $json.chaveAcesso }}`). Se você já tiver o XML da nota na etapa anterior, passe-o em **XML Autorizado (Opcional)** (`={{ $json.xmlNfseAutorizado }}`) para gerar o PDF instantaneamente sem precisar consultar a SEFIN novamente.
  - **Modo Manual:** Preencha os campos diretamente para gerar o espelho sem consulta à SEFIN.
- O arquivo PDF é entregue no binário **`danfse`** e o HTML no binário **`danfse_html`**, prontos para conectar a um nó de **Send Email**, **HTTP Request**, **Google Drive**, **Telegram**, etc.

### 3. Exemplo de JSON de Retorno (Emissão)
```json
{
  "sucesso": true,
  "status": "AUTORIZADA",
  "statusCode": 201,
  "mensagemRetorno": "NFS-e autorizada com sucesso pela SEFIN Nacional.",
  "ambiente": "Homologação (Produção Restrita)",
  "chaveAcesso": "5003702220000000000191000010000000000001234567890",
  "numeroNfse": "15",
  "serieDps": "1",
  "numeroDps": "15",
  "danfseUrl": "https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=500370222...",
  "erros": [],
  "alertas": []
}
```

---

## 👤 Autor

**Amaury Gomes Ibanez**
- GitHub: [@amaurygomes](https://github.com/amaurygomes)
- E-mail: [amaury_mju@hotmail.com](mailto:amaury_mju@hotmail.com)
- Websites: [agnez.com.br](https://agnez.com.br) • [amaurygomes.com.br](https://amaurygomes.com.br)

---

## 📄 Licença

Distribuído sob a **Licença MIT** — livre para uso pessoal, comercial, modificação e distribuição. Veja o arquivo [LICENSE.md](LICENSE.md) para mais detalhes.
