import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class MetafieldInput {
  @Field({ nullable: true })
  id?: string;

  @Field()
  namespace: string;

  @Field()
  key: string;

  @Field({ nullable: true })
  value?: string;

  @Field({ nullable: true })
  type?: string;
}
