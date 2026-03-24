#!/bin/bash
# Erstellt die 5 GitHub Issues in der richtigen Reihenfolge.
# Ausfuehren aus dem Projekt-Root: bash docs/issues/create-issues.sh
# Voraussetzung: gh auth login

set -e

echo "=== Issue 1: DB-Migration + DataService ==="
ISSUE1=$(gh issue create \
  --title "Vertragsspalte: DB-Migration + DataService Config + Query JOIN" \
  --body-file docs/issues/01-vertrag-migration-dataservice.md \
  --label "enhancement" | grep -oE '[0-9]+$')
echo "Created issue #$ISSUE1"

echo "=== Issue 2: Vertragsspalte in Rechnungsliste ==="
sed -i '' "s/Blocked by Issue #1/Blocked by #$ISSUE1/" docs/issues/02-vertragsspalte-rechnungsliste.md
ISSUE2=$(gh issue create \
  --title "Vertragsspalte: Spalte in Rechnungsliste (Link/Warn-Icon)" \
  --body-file docs/issues/02-vertragsspalte-rechnungsliste.md \
  --label "enhancement" | grep -oE '[0-9]+$')
echo "Created issue #$ISSUE2"

echo "=== Issue 3: Auto-Zuordnung beim Erstellen ==="
sed -i '' "s/Blocked by Issue #1/Blocked by #$ISSUE1/" docs/issues/03-auto-zuordnung-beim-erstellen.md
ISSUE3=$(gh issue create \
  --title "Vertragsspalte: Auto-Zuordnung vertrag_id beim Erstellen" \
  --body-file docs/issues/03-auto-zuordnung-beim-erstellen.md \
  --label "enhancement" | grep -oE '[0-9]+$')
echo "Created issue #$ISSUE3"

echo "=== Issue 4: Manuelles Bearbeiten im Formular ==="
sed -i '' "s/Blocked by Issue #1/Blocked by #$ISSUE1/" docs/issues/04-manuelles-bearbeiten-formular.md
ISSUE4=$(gh issue create \
  --title "Vertragsspalte: Vertrag-Dropdown im Rechnungsformular" \
  --body-file docs/issues/04-manuelles-bearbeiten-formular.md \
  --label "enhancement" | grep -oE '[0-9]+$')
echo "Created issue #$ISSUE4"

echo "=== Issue 5: Integration-Tests ==="
sed -i '' "s/Blocked by Issue #2/Blocked by #$ISSUE2/" docs/issues/05-integration-tests.md
sed -i '' "s/Blocked by Issue #3/Blocked by #$ISSUE3/" docs/issues/05-integration-tests.md
ISSUE5=$(gh issue create \
  --title "Vertragsspalte: Integration-Tests" \
  --body-file docs/issues/05-integration-tests.md \
  --label "enhancement,testing" | grep -oE '[0-9]+$')
echo "Created issue #$ISSUE5"

echo ""
echo "=== Fertig! Erstellte Issues: ==="
echo "#$ISSUE1 - DB-Migration + DataService"
echo "#$ISSUE2 - Spalte in Rechnungsliste (blocked by #$ISSUE1)"
echo "#$ISSUE3 - Auto-Zuordnung (blocked by #$ISSUE1)"
echo "#$ISSUE4 - Formular-Dropdown (blocked by #$ISSUE1)"
echo "#$ISSUE5 - Integration-Tests (blocked by #$ISSUE2, #$ISSUE3)"
