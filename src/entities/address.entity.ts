import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Country } from './country.entity';

@Entity('addresses')
export class Address {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text', nullable: true })
    address1?: string | null;

    @Column({ type: 'text', nullable: true })
    address2?: string | null;

    @Column({ type: 'text', nullable: true })
    city?: string | null;

    @Column({ type: 'text', nullable: true })
    province?: string | null;

    @Column({ type: 'text', nullable: true })
    zipCode?: string | null;

    @ManyToOne(() => Country, { nullable: true })
    @JoinColumn({ name: 'country_id' })
    @Index()
    country?: Country | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}


