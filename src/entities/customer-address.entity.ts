import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { Address } from './address.entity';

@Entity('customer_addresses')
@Index(['customer', 'address'], { unique: true })
export class CustomerAddress {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Customer, (customer) => customer.addresses, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @ManyToOne(() => Address, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'address_id' })
    address: Address;

    @Column({ type: 'boolean', default: false })
    isDefault: boolean;
}


