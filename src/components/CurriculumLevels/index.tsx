import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type CurriculumLevel = {
  label: string;
  description: string;
  to: string;
};

const levels: readonly CurriculumLevel[] = [
  {
    label: '1. Fundamentals',
    description: 'Build the vocabulary for requirements, scale, reliability, and consistency.',
    to: '/docs/01-fundamentals',
  },
  {
    label: '2. Building blocks',
    description: 'Understand the components that route requests, store data, and move messages.',
    to: '/docs/02-building-blocks',
  },
  {
    label: '3. Patterns',
    description: 'Combine components to handle recurring problems in distributed systems.',
    to: '/docs/03-patterns',
  },
  {
    label: '4. Architecting on Azure',
    description: 'Choose Azure services with reliability, security, operations, and cost in mind.',
    to: '/docs/04-azure',
  },
  {
    label: '5. Advanced',
    description: 'Reason about consensus, global systems, stream processing, and AI workloads.',
    to: '/docs/05-advanced',
  },
  {
    label: '6. Case studies',
    description: 'Work through complete designs, from requirements to an Azure architecture.',
    to: '/docs/06-case-studies',
  },
];

export default function CurriculumLevels(): ReactNode {
  return (
    <section className={styles.levels} aria-labelledby="learning-path">
      <div className="container">
        <Heading as="h2" id="learning-path">Your learning path</Heading>
        <p>Start with the fundamentals. Build toward complete system designs.</p>
        <div className="row">
          {levels.map(({label, description, to}) => (
            <div className={`col col--4 ${styles.column}`} key={to}>
              <Link className={`card ${styles.card}`} to={to}>
                <div className="card__header">
                  <Heading as="h3">{label}</Heading>
                </div>
                <div className="card__body">
                  <p>{description}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
