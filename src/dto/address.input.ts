import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class AddressInput {
  @Field({ nullable: true })
  address1: string;

  @Field({ nullable: true })
  address2: string;

  @Field({ nullable: true })
  city: string;

  @Field({ nullable: true })
  province: string;

  @Field({ nullable: true })
  country: string;

  @Field({ nullable: true })
  zip: string;
}