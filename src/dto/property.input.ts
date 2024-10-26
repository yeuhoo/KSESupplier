import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class PropertyInput {
  @Field()
  key: string;

  @Field()
  value: string;
}
