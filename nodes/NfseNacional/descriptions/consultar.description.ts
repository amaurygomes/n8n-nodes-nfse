import type { INodeProperties } from 'n8n-workflow';

export const consultarFields: INodeProperties[] = [
	{
		displayName: 'Chave de Acesso (50 Dígitos)',
		name: 'chaveAcessoConsulta',
		type: 'string',
		default: '',
		required: true,
		placeholder: '3550308000000000000191000010000000000001234567890',
		description: 'Chave de acesso completa de 50 dígitos da NFS-e Nacional',
		displayOptions: {
			show: {
				operation: ['consultar'],
			},
		},
	},
	{
		displayName: 'Opções Adicionais',
		name: 'consultarOpcoes',
		type: 'collection',
		placeholder: 'Adicionar Opção',
		default: {},
		displayOptions: { show: { operation: ['consultar'] } },
		options: [
			{
				displayName: 'Gerar DANFSE em HTML',
				name: 'gerarHtml',
				type: 'boolean',
				default: false,
				description: 'Se ativado, gera também o arquivo HTML do DANFSE',
			},
			{
				displayName: 'Gerar DANFSE em PDF',
				name: 'gerarPdf',
				type: 'boolean',
				default: false,
				description: 'Se ativado, gera o PDF do DANFSE com os dados retornados pela consulta',
			},
			{
				displayName: 'Ignorar Erros de Certificado SSL',
				name: 'rejectUnauthorized',
				type: 'boolean',
				default: false,
				description: 'Se ativado, ignora erros de validação SSL/TLS',
			},
			{
				displayName: 'Omitir Dados Sigilosos (Modo Gravação / Demo)',
				name: 'mascararDadosSigilosos',
				type: 'boolean',
				default: false,
				description: 'Se ativado, mascara e oculta dados sigilosos (CPF, CNPJ, e-mails, telefones, endereço e chave de acesso) no PDF e HTML do DANFSE gerados. Ideal para gravação de vídeos de tela, demonstrações e tutoriais sem expor dados reais.',
			},
			{
				displayName: 'Tempo Limite da Requisição (ms)',
				name: 'timeoutMs',
				type: 'number',
				default: 25000,
				description: 'Tempo máximo em milissegundos para aguardar a resposta da SEFIN Nacional',
			},
		],
	},
];
