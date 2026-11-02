INSERT INTO papers (paper_id, title, abstract, doi, publication_year, venue) VALUES
  (1, 'Molecular Property Prediction with Graph Neural Networks', 'A message-passing framework for learning molecular representations and predicting quantum chemical properties directly from molecular graphs.', '10.5555/atlas.2017.001', 2017, 'Proceedings of ICML'),
  (2, 'Attention Is All You Need', 'The Transformer architecture relies on attention mechanisms to model sequence relationships, removing recurrence from machine translation systems.', '10.5555/atlas.2017.002', 2017, 'Advances in Neural Information Processing Systems'),
  (3, 'Learning Transferable Visual Models From Natural Language Supervision', 'Contrastive language-image pre-training learns visual concepts from natural language supervision and supports zero-shot transfer to downstream datasets.', '10.5555/atlas.2021.003', 2021, 'Proceedings of ICML')
ON DUPLICATE KEY UPDATE
  title = VALUES(title), abstract = VALUES(abstract), publication_year = VALUES(publication_year), venue = VALUES(venue);

INSERT INTO authors (author_id, display_name) VALUES
  (1, 'J. Gilmer'), (2, 'S. S. Schoenholz'), (3, 'P. F. Riley'), (4, 'O. Vinyals'), (5, 'G. E. Dahl'),
  (6, 'A. Vaswani'), (7, 'N. Shazeer'), (8, 'N. Parmar'),
  (9, 'A. Radford'), (10, 'J. W. Kim'), (11, 'C. Hallacy')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

INSERT INTO paper_authors (paper_id, author_id, author_order) VALUES
  (1, 1, 1), (1, 2, 2), (1, 3, 3), (1, 4, 4), (1, 5, 5),
  (2, 6, 1), (2, 7, 2), (2, 8, 3),
  (3, 9, 1), (3, 10, 2), (3, 11, 3)
ON DUPLICATE KEY UPDATE author_order = VALUES(author_order);

INSERT INTO paper_topics (paper_id, topic) VALUES
  (1, 'Machine learning'), (1, 'Biology'),
  (2, 'Machine learning'), (2, 'Natural language'),
  (3, 'Computer vision'), (3, 'Natural language')
ON DUPLICATE KEY UPDATE topic = VALUES(topic);
