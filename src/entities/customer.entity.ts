import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Company } from './company.entity';
import { Address } from './address.entity';
import { CustomerAddress } from './customer-address.entity';

@Entity('customers')
@Index(['shopifyGid'], { unique: true })
@Index(['priceLevel'])
export class Customer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    shopifyGid: string;

    @Column({ type: 'text', nullable: true })
    firstName?: string | null;

    @Column({ type: 'text', nullable: true })
    lastName?: string | null;

    @Column({ type: 'text', nullable: true })
    email?: string | null;

    @ManyToOne(() => Company, { nullable: true })
    @JoinColumn({ name: 'company_id' })
    company?: Company | null;

    @ManyToOne(() => Address, { nullable: true })
    @JoinColumn({ name: 'default_address_id' })
    defaultAddress?: Address | null;

    @Column({ type: 'text', nullable: true })
    priceLevel?: string | null;

    @Column({ type: 'text', array: true, default: '{}' })
    tags: string[];

    @OneToMany(() => CustomerAddress, (ca) => ca.customer, { cascade: true })
    addresses: CustomerAddress[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: 'timestamptz', nullable: true })
    lastSyncedAt?: Date | null;
}


