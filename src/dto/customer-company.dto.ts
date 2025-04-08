import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CustomerCompany {
  @Field()
  id: string;

  @Field()
  company: string;
}
