import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { Address } from './address.entity';
import { DraftOrderTag } from './draft-order-tag.entity';

@Entity('draft_orders')
@Index(['shopifyGid'], { unique: true })
@Index(['customer'])
@Index(['status'])
@Index(['dateCreated'])
export class DraftOrder {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    shopifyGid: string;

    @Column({ type: 'text', nullable: true })
    name?: string | null;

    @Column({ type: 'text', nullable: true })
    note?: string | null;

    @ManyToOne(() => Customer, { nullable: true })
    @JoinColumn({ name: 'customer_id' })
    customer?: Customer | null;

    @ManyToOne(() => Address, { nullable: true })
    @JoinColumn({ name: 'shipping_address_id' })
    shippingAddress?: Address | null;

    @Column({ type: 'jsonb', nullable: true })
    shippingLine?: Record<string, any> | null;

    @Column({ type: 'jsonb', nullable: true })
    productIdArray?: any | null;

    @Column({ type: 'jsonb', nullable: true })
    lineItems?: any | null;

    @Column({ type: 'text', nullable: true })
    status?: string | null;

    @Column({ type: 'text', nullable: true })
    jobCode?: string | null;

    @Column({ type: 'text', nullable: true })
    orderNotes?: string | null;

    @Column({ type: 'boolean', default: false })
    forShippingQuote: boolean;

    @Column({ type: 'text', nullable: true })
    invoiceUrl?: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    dateCreated?: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    completedAt?: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: 'timestamptz', nullable: true })
    lastSyncedAt?: Date | null;

    @OneToMany(() => DraftOrderTag, (t) => t.draftOrder, { cascade: true })
    tags?: DraftOrderTag[];
}


