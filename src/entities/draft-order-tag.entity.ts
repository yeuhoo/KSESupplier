import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DraftOrder } from './draft-order.entity';

@Entity('draft_order_tags')
@Index(['draftOrder', 'tag'], { unique: true })
export class DraftOrderTag {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => DraftOrder, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'draft_order_id' })
    draftOrder: DraftOrder;

    @Column({ type: 'text' })
    tag: string;

    @CreateDateColumn()
    createdAt: Date;
}


