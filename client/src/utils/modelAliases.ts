import type { Option } from '~/common';
import type { TEndpointsConfig } from 'librechat-data-provider';

export function getModelOptions(
    models: string[],
    endpoint: string | null | undefined,
    endpointsConfig: TEndpointsConfig | undefined
): Option[] {
    if (!models || models.length === 0) {
        return [];
    }

    const modelNames = (endpoint && endpointsConfig?.[endpoint]?.modelNames) as
        | Record<string, string>
        | undefined;

    return models.map((model): Option => {
        const displayName = modelNames?.[model] ?? model;
        return {
            value: model,
            label: displayName,
        };
    });
}

export function getModelDisplayName(
    model: string,
    endpoint: string | null | undefined,
    endpointsConfig: TEndpointsConfig | undefined
): string {
    if (!model || !endpoint) {
        return model;
    }

    const modelNames = endpointsConfig?.[endpoint]?.modelNames as
        | Record<string, string>
        | undefined;

    return modelNames?.[model] ?? model;
}
