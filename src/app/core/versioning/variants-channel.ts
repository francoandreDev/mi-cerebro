// Cross-tab signalling for variants. Keeping the channel name and the
// message shape in their own file lets SwitchVariantService and any
// future listener (e.g. the dev panel for criterion #2) import without
// pulling in the whole switch service.

export const VARIANTS_CHANNEL_NAME = 'mc-variants';

export interface VariantsBroadcast {
  readonly type: 'switched';
  readonly variantId: string;
  readonly requestedAt: number;
}
