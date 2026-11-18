import type { INodeProperties } from 'n8n-workflow';

import { operationField } from './operation.description';
import { emitirFields } from './emitir.description';
import { consultarFields } from './consultar.description';
import { consultarDpsFields } from './consultarDps.description';
import { cancelarFields } from './cancelar.description';
import { consultarEventosFields } from './consultarEventos.description';
import { gerarDanfseFields } from './gerarDanfse.description';

export const nodeProperties: INodeProperties[] = [
	operationField,
	...emitirFields,
	...consultarFields,
	...consultarDpsFields,
	...cancelarFields,
	...consultarEventosFields,
	...gerarDanfseFields,
];
