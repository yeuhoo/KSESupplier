import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DraftOrderTag {
    @Field()
    id: string;

    @Field()
    draftOrderId: string;

    @Field()
    tag: string;
}