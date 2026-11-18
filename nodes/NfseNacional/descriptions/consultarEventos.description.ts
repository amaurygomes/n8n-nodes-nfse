import type { INodeProperties } from 'n8n-workflow';

export const consultarEventosFields: INodeProperties[] = [
	{
		displayName: 'Chave de Acesso (50 Dígitos)',
		name: 'chaveAcessoEventos',
		type: 'string',
		default: '',
		required: true,
		placeholder: '3550308000000000000191000010000000000001234567890',
		description: 'Chave de acesso completa de 50 dígitos da NFS-e para consultar o histórico de eventos',
		displayOptions: {
			show: {
				operation: ['consultarEventos'],
			},
		},
	},
	{
		displayName: 'Opções Adicionais',
		name: 'eventosOpcoes',
		type: 'collection',
		placeholder: 'Adicionar Opção',
		default: {},
		displayOptions: { show: { operation: ['consultarEventos'] } },
		options: [
			{
				displayName: 'Tipo de Evento',
				name: 'tipoEvento',
				type: 'options',
				options: [
					{
						name: '101101 - Cancelamento de NFS-e',
						value: '101101',
						description: 'Evento de cancelamento da NFS-e registrado pelo prestador',
					},
					{
						name: '105102 - Cancelamento por Substituição',
						value: '105102',
						description: 'Evento de cancelamento por substituição gerado pelo sistema emissor',
					},
				],
				default: '101101',
				description: 'Tipo do evento a ser consultado',
			},
			{
				displayName: 'Número Sequencial do Evento',
				name: 'numSeqEvento',
				type: 'string',
				default: '1',
				placeholder: '1',
				description: 'Número sequencial do evento (para cancelamento geralmente é 1)',
			},
			{
				displayName: 'Ignorar Erros de Certificado SSL',
				name: 'rejectUnauthorized',
				type: 'boolean',
				default: false,
				description: 'Se ativado, ignora erros de validação SSL/TLS',
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
