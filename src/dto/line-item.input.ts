import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class LineItemInput {
  @Field()
  variantId: string;

  @Field()
  quantity: number;
}
