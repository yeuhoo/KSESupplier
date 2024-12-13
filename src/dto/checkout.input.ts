// dto/checkout.input.ts
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CheckoutInput {
  @Field()
  customerEmail: string;

  @Field()
  customerFirstName: string;

  @Field()
  customerLastName: string;

  @Field()
  address1: string;

  @Field({ nullable: true })
  address2?: string;

  @Field()
  city: string;

  @Field()
  province: string;

  @Field()
  country: string;

  @Field()
  zip: string;

  @Field(() => [CartItemInput])
  cartItems: CartItemInput[];
}

@InputType()
export class CartItemInput {
  @Field()
  productId: string;

  @Field()
  variantId: string;

  @Field()
  quantity: number;
}
