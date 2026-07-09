#!/bin/sh

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Generating Prisma client..."
npx prisma generate

if [ "$SEED_SAMPLE_DATA" = "true"  ]; then
  echo "Seed sample data enabled, importing sample data..."
    # Import exercises if CSV exists
    if [ -f "./data/sample-exercises.csv" ]; then
        npx tsx scripts/import-exercises-with-attributes.ts ./data/sample-exercises.csv
    else
        echo "No exercises sample data found, skipping import."
    fi

    # Create fixed local demo accounts so login works without sign-up / OAuth.
    echo "Seeding local demo accounts (no external services required)..."
    npx tsx scripts/seed-demo-user.ts
else
  echo "Skipping sample data import."
fi

echo "Starting the app..."
exec "$@"  # runs the CMD from the Dockerfile
