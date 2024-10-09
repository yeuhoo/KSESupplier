import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  firstName: string;
  
  @Field({ nullable: true }) 
  lastName: string;

  @Field({ nullable: true }) 
  email: string;
}
