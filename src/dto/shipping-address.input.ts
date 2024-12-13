import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class ShippingAddressInput {
  @Field()
  address1: string;

  @Field()
  city: string;

  @Field()
  province: string;

  @Field()
  country: string;

  @Field()
  zip: string;
  address2: any;
}
