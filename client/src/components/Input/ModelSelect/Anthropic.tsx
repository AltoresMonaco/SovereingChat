import { SelectDropDown } from '@librechat/client';
import type { TModelSelectProps } from '~/common';
import SelectDropDownPop from '~/components/Input/ModelSelect/SelectDropDownPop';
import { cn, cardStyle } from '~/utils';
import { useModelAliases } from '~/hooks/useModelAliases';
import { useMemo } from 'react';

export default function Anthropic({
  conversation,
  setOption,
  models,
  showAbove,
  popover = false,
}: TModelSelectProps) {
  const Menu = popover ? SelectDropDownPop : SelectDropDown;
  const modelOptions = useModelAliases(conversation?.endpoint, models);

  const selectedOption = useMemo(() => {
    if (!conversation?.model) return '';
    const option = modelOptions.find(opt => opt.value === conversation.model);
    return option || conversation.model;
  }, [conversation?.model, modelOptions]);

  return (
    <Menu
      value={selectedOption}
      setValue={setOption('model')}
      availableValues={modelOptions.length > 0 ? modelOptions : models}
      showAbove={showAbove}
      showLabel={false}
      className={cn(
        cardStyle,
        'z-50 flex h-[40px] w-48 min-w-48 flex-none items-center justify-center px-4 ring-0 hover:cursor-pointer',
      )}
    />
  );
}
