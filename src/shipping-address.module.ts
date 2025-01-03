import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ShippingAddress {
  @Field()
  address1: string;

  @Field()
  city: string;

  @Field()
  province: string;
  
  @Field({ nullable: true })
  company?: string;

  @Field()
  country: string;

  @Field()
  zip: string;
}
