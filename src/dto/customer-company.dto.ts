import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CustomerCompany {
  @Field()
  id: string;
  
  @Field({ nullable: true })
  firstName: string;

  @Field({ nullable: true })
  lastName: string;

  @Field({ nullable: true })
  company: string;

  @Field({ nullable: true})
  priceLevel: string;
}
