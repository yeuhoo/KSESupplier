import { InputType, Field } from '@nestjs/graphql';
import { ShippingAddressInput } from './shipping-address.input';
import { PropertyInput } from './property.input';
import { Variant } from 'src/draft-order.model';
@InputType()
export class LineItemInput {
  @Field()
  variantId: string;

  @Field()
  quantity: number;

  @Field(() => Variant, { nullable: true })
  variant?: Variant;

  @Field({ nullable: true })
  originalUnitPrice?: number;

  @Field({ nullable: true })
  title?: string;

  @Field(() => [PropertyInput], { nullable: true })
  properties?: PropertyInput[];
}

@InputType()
export class DiscountInput {
  @Field()
  description: string;

  @Field()
  value: number;

  @Field()
  valueType: string;
}

@InputType()
export class ShippingLineInput {
  @Field()
  title: string;

  @Field()
  price: number;
}

@InputType()
export class DraftOrderInput {
  @Field()
  customerId: string;

  @Field(() => [LineItemInput])
  lineItems: LineItemInput[];

  @Field(() => ShippingAddressInput)
  shippingAddress: ShippingAddressInput;

  @Field(() => DiscountInput, { nullable: true })
  appliedDiscount?: DiscountInput;

  @Field({ nullable: true })
  taxExempt?: boolean;

  @Field(() => ShippingLineInput, { nullable: true })
  shippingLine?: ShippingLineInput;
}
