import { useMemo } from 'react';
import { useGetEndpointsQuery } from '~/data-provider';
import { getModelOptions } from '~/utils/modelAliases';

export function useModelAliases(endpoint: string | null | undefined, models: string[]) {
  const { data: endpointsConfig = {} } = useGetEndpointsQuery();

  const modelOptions = useMemo(() => {
    return getModelOptions(models, endpoint, endpointsConfig);
  }, [endpoint, models, endpointsConfig]);

  return modelOptions;
}
