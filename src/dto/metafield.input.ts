import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class MetafieldInput {
  @Field()
  namespace: string;

  @Field()
  key: string;

  @Field()
  value: string;

  @Field()
  type: string;  
}
