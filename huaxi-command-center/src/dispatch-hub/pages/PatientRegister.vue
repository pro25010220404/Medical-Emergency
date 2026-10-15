<script setup lang="ts">
import { onMounted, ref } from 'vue'
import RegisterForm from '../components/RegisterForm.vue'
import { contextFromHash, loadEvents, type PatientForm } from '../context'

const seed = ref<Partial<PatientForm>>({})

onMounted(async () => {
  const ctx = contextFromHash()
  seed.value = { ...ctx }
  if (!ctx.eventId && !ctx.vehicleId && !ctx.task120Id) return
  const data = await loadEvents()
  const ev =
    data.events.find((e) => e.id === ctx.eventId) ||
    data.events.find((e) => e.vehicleId === ctx.vehicleId) ||
    data.events.find((e) => e.task120Id === ctx.task120Id)
  if (!ev) return
  seed.value = {
    eventId: ev.id,
    task120Id: ev.task120Id,
    vehicleId: ev.vehicleId,
    vehiclePlate: ev.vehiclePlate,
    chiefComplaint: ev.chiefComplaint,
  }
})
</script>

<template>
  <div class="dh-page">
    <section class="dh-page-head">
      <div>
        <h2 class="dh-h2">急救患者登记</h2>
        <p class="dh-lead">这一屏填完就保存。任务号和车牌从出警页带入。</p>
      </div>
      <a class="dh-back-inline" href="#live">返回实时出警</a>
    </section>
    <div class="dh-register">
      <section class="dh-panel">
        <RegisterForm :seed="seed" />
      </section>
      <aside class="dh-side-note">
        <h3>当前出车</h3>
        <p>任务号和车牌从出警带入。姓名在车上直接填，保存后即可发起会诊。</p>
        <dl>
          <div><dt>任务号</dt><dd>{{ seed.task120Id || '未关联' }}</dd></div>
          <div><dt>车牌</dt><dd>{{ seed.vehiclePlate || '未选车' }}</dd></div>
          <div><dt>主诉</dt><dd>{{ seed.chiefComplaint || '待填写' }}</dd></div>
        </dl>
      </aside>
    </div>
  </div>
</template>
