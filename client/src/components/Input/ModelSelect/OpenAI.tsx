import { SelectDropDown } from '@librechat/client';
import type { TModelSelectProps } from '~/common';
import SelectDropDownPop from '~/components/Input/ModelSelect/SelectDropDownPop';
import { useModelAliases } from '~/hooks/useModelAliases';
import { cn, cardStyle } from '~/utils';

export default function OpenAI({
  conversation,
  setOption,
  models,
  showAbove = true,
  popover = false,
}: TModelSelectProps) {
  const Menu = popover ? SelectDropDownPop : SelectDropDown;
  const modelOptions = useModelAliases(conversation?.endpoint, models);

  return (
    <Menu
      value={conversation?.model ?? ''}
      setValue={setOption('model')}
      availableValues={modelOptions.length > 0 ? modelOptions : models}
      showAbove={showAbove}
      showLabel={false}
      className={cn(
        cardStyle,
        'z-50 flex h-[40px] w-48 min-w-48 flex-none items-center justify-center px-4 hover:cursor-pointer',
      )}
    />
  );
}
