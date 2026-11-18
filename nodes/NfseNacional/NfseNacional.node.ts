import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { nodeProperties } from './descriptions';
import { buildOperationContext, operationHandlers } from './operations';

export class NfseNacional implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NFS-e Nacional',
		name: 'nfseNacional',
		icon: 'file:nfseNacional.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Emissão, consulta e cancelamento de NFS-e no Padrão Nacional (SEFIN/ADN da Receita Federal) com certificado A1 e mTLS',
		defaults: {
			name: 'NFS-e Nacional',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'nfseNacionalApi',
				required: true,
			},
		],
		properties: nodeProperties,
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const ctx = await buildOperationContext.call(this);
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < ctx.items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const handler = operationHandlers[operation];
				if (!handler) {
					throw new NodeOperationError(this.getNode(), `Operação não suportada: ${operation}`, { itemIndex: i });
				}
				returnData.push(...(await handler.call(this, i, ctx, operation)));
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (this.continueOnFail()) {
					returnData.push({
						pairedItem: { item: i },
						json: { error: errorMessage },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error | string);
			}
		}

		return [returnData];
	}
}
