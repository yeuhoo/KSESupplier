import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CustomerCompany {
  @Field()
  id: string;
  
  @Field({ nullable: true })
  firstName: string;

  @Field({ nullable: true })
  lastName: string;

  @Field()
  company: string;

  @Field()
  priceLevel: string;
}
