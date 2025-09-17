import { SelectDropDown } from '@librechat/client';
import type { TModelSelectProps } from '~/common';
import SelectDropDownPop from '~/components/Input/ModelSelect/SelectDropDownPop';
import { cn, cardStyle } from '~/utils';
import { useModelAliases } from '~/hooks/useModelAliases';

export default function ChatGPT({
  conversation,
  setOption,
  models,
  showAbove,
  popover = false,
}: TModelSelectProps) {
  if (!conversation) {
    return null;
  }
  const { conversationId, model } = conversation;
  if (conversationId !== 'new') {
    return null;
  }
  const Menu = popover ? SelectDropDownPop : SelectDropDown;
  const modelOptions = useModelAliases(conversation?.endpoint, models);
  
  return (
    <Menu
      value={model ?? ''}
      setValue={setOption('model')}
      availableValues={modelOptions.length > 0 ? modelOptions : models}
      showAbove={showAbove}
      showLabel={false}
      className={cn(
        cardStyle,
        'z-50 flex h-[40px] w-60 min-w-48 flex-none items-center justify-center px-4 ring-0 hover:cursor-pointer',
      )}
    />
  );
}
