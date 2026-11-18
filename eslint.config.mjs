import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
	...configWithoutCloudSupport,
	{
		rules: {
			'@n8n/community-nodes/no-runtime-dependencies': 'off',
			'@n8n/community-nodes/icon-prefer-themed-variants': 'off',
			'@n8n/community-nodes/credential-test-required': 'off',
			'n8n-nodes-base/cred-class-field-display-name-missing-api': 'off',
			'n8n-nodes-base/cred-class-field-display-name-miscased': 'off',
			'n8n-nodes-base/node-param-description-boolean-without-whether': 'off',
			'n8n-nodes-base/node-param-display-name-miscased': 'off',
			'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
			'n8n-nodes-base/node-param-placeholder-miscased-id': 'off',
			'n8n-nodes-base/node-param-description-miscased-id': 'off',
		},
	},
];
