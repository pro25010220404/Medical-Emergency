<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warning_trends', function (Blueprint $table) {
            $table->id();
            $table->string('trend_id', 32)->unique()->comment('趋势编号，如 TR-01');
            $table->string('patient_label', 64)->default('');
            $table->string('patient_id', 32)->nullable()->index()->comment('关联患者业务编号');
            $table->string('metric', 32)->default('');
            $table->decimal('current_value', 10, 2)->default(0);
            $table->decimal('predicted_value', 10, 2)->default(0);
            $table->unsignedInteger('within_minutes')->default(0);
            $table->string('note', 255)->default('');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warning_trends');
    }
};
