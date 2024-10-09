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

  @Field()
  invoiceUrl: string;

  @Field(() => [LineItem])  
  lineItems: LineItem[];

  @Field(() => [Metafield], { nullable: 'itemsAndList' })  
  metafields?: Metafield[];

  @Field(() => ShippingAddress, { nullable: true })  
  shippingAddress: ShippingAddress;

  @Field(() => Order, { nullable: true })  
  order?: Order;
  
}
