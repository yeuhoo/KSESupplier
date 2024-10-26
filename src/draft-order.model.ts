import { Field, ObjectType } from '@nestjs/graphql';
import { ShippingAddress } from './shipping-address.module';

@ObjectType()
export class Metafield {
  @Field()
  id: string;

  @Field()
  namespace: string;

  @Field()
  key: string;

  @Field()
  value: string;
}

@ObjectType()
export class LineItem {
  @Field()
  title: string;

  @Field()
  quantity: number;

  @Field({ nullable: true })
  price?: number;

  @Field({ nullable: true })
  discounted_price?: number;

  @Field({ nullable: true })
  final_price?: number;
}


@ObjectType()
export class CartLevelDiscount {
  @Field()
  code: string;

  @Field()
  value: number;
}

@ObjectType()
export class Order {
  @Field()
  id: string;
}

@ObjectType()
export class DraftOrder {
  @Field()
  id: string;

  @Field({ nullable: true })
  customerId?: string;

  @Field({ nullable: true })
  note?: string;

  @Field({ nullable: true })
  original_total_price?: number;

  @Field({ nullable: true })
  total_price?: number;

  @Field({ nullable: true })
  total_discount?: number;

  @Field({ nullable: true })
  requires_shipping?: boolean;

  @Field(() => [LineItem], { nullable: true })
  lineItems?: LineItem[];

  @Field({ nullable: true })
  createdAt?: string;

  @Field(() => [Metafield], { nullable: true })
  metafields?: Metafield[];

  @Field(() => [CartLevelDiscount], { nullable: true })
  cart_level_discount_applications?: CartLevelDiscount[];

  @Field(() => ShippingAddress, { nullable: true })
  shippingAddress?: ShippingAddress;
}
