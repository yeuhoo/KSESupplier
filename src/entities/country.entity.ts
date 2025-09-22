import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('countries')
@Index(['countryCode'], { unique: true })
export class Country {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    countryCode: string;

    @Column({ type: 'text' })
    countryName: string;
}


